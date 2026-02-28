const express = require('express');
const router = express.Router();
const InterventionService = require('../services/intervention');
const { logger, auditLog, generateCorrelationId } = require('../services/logger');
const NuveiAdapter = require('../services/psp/nuvei-adapter');
const SumsubAdapter = require('../services/kyc/sumsub-adapter');
const supabaseService = require('../services/supabase');
let rabbitmq;
try {
    rabbitmq = require('../services/rabbitmq');
} catch (e) {
    logger.warn('[Webhooks] RabbitMQ not available, ignoring event publishing.');
}

/**
 * Fast Track Webhook Handler
 * Receives real-time player restriction commands from CRM.
 */
router.post('/fasttrack', async (req, res) => {
    const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
    const { user_id, action, reason, operator_id } = req.body;

    logger.info(`Received Fast Track Webhook`, { user_id, action, correlationId });

    if (!user_id || !action) {
        return res.status(400).json({ error: 'Missing user_id or action' });
    }

    try {
        await auditLog({
            correlationId,
            brandId: brand_id || 1,
            actor_id: 'FAST_TRACK_CRM',
            action: `inbound:crm_restriction:${action}`,
            entity_type: 'user',
            entity_id: user_id,
            status: 'success',
            metadata: { request: req.body },
            message: `CRM triggered ${action} for user ${user_id}`
        });

        // Map FT Actions to NeoStrike Interventions
        switch (action) {
            case 'LOCK_PLAYER':
                // In production, update user status in Supabase
                InterventionService.triggerRealityCheck(user_id, 'ACCOUNT_LOCKED_BY_CRM', 'ACCOUNT_RESTRICTED');
                break;
            case 'REALITY_CHECK_FORCE':
                InterventionService.triggerRealityCheck(user_id, reason || 'CRM_MANDATORY_BREAK');
                break;
            default:
                logger.warn(`Unknown action from CRM: ${action}`);
        }

        res.json({ success: true, correlationId });
    } catch (error) {
        logger.error(`Failed to process FT Webhook`, { correlationId, error: error.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * F9: Nuvei PSP Webhook
 * Receives deposit confirmation from Nuvei (BYOC adapter structure).
 */
router.post('/psp/nuvei', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        // Ensure parsing handles the body correctly especially if we used raw middleware
        let rawPayload = req.body;
        let bodyJson = req.body;
        if (Buffer.isBuffer(req.body)) {
            rawPayload = req.body.toString('utf8');
            bodyJson = JSON.parse(rawPayload);
        } else {
            rawPayload = JSON.stringify(req.body);
        }

        // Mock request object for the adapter holding everything needed
        const adapterReq = {
            headers: req.headers,
            body: bodyJson
        };

        const result = await NuveiAdapter.handleWebhook(adapterReq, rawPayload);
        res.status(result.status).json(result);
    } catch (error) {
        logger.error(`Failed to process Nuvei Webhook`, { error: error.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * F10: Sumsub KYC Webhook
 * Receives verification updates from Sumsub.
 */
router.post('/kyc/sumsub', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        let rawPayload = req.body;
        let bodyJson = req.body;
        if (Buffer.isBuffer(req.body)) {
            rawPayload = req.body.toString('utf8');
            bodyJson = JSON.parse(rawPayload);
        } else {
            rawPayload = JSON.stringify(req.body);
        }

        const adapterReq = {
            headers: req.headers,
            body: bodyJson
        };

        const result = SumsubAdapter.handleWebhook(adapterReq, rawPayload);

        if (result.success && result.mappedEvent) {
            const { player_id, new_status, wallet_blocked, sumsub_review_answer, sumsub_reject_type, applicant_id } = result.mappedEvent;

            logger.info('[Webhook] Updating User KYC Status', { player_id, new_status, wallet_blocked });

            // 1. Update User Table
            const user = await supabaseService.getUserById(player_id);
            if (user) {
                const previous_status = user.kyc_status;
                const tenant_id = user.brand_id;
                const kyc_verified_at = new_status === 'VERIFIED' ? new Date().toISOString() : user.kyc_verified_at;

                await supabaseService.updateUser(user.id, {
                    kyc_status: new_status,
                    wallet_blocked: wallet_blocked,
                    sumsub_applicant_id: applicant_id,
                    kyc_verified_at
                });

                // 2. Update Profile Table (Simplified for PoC)
                await supabaseService.upsertPlayerProfile({
                    player_id: user.id,
                    status: new_status,
                    verified_at: new_status === 'VERIFIED' ? new Date().toISOString() : null
                });

                // 3. Log KYC Event
                await supabaseService.logKycEvent({
                    tenant_id,
                    player_id: user.id,
                    event_type: 'STATUS_UPDATE',
                    previous_status,
                    new_status,
                    sumsub_review_answer,
                    sumsub_reject_type,
                    metadata: { applicant_id, webhook_payload: bodyJson }
                });

                // 4. Publish to RabbitMQ
                if (rabbitmq && rabbitmq.publishEvent) {
                    await rabbitmq.publishEvent(`user.${player_id}.kyc`, {
                        player_id,
                        tenant_id,
                        type: 'KYC_UPDATE',
                        previous_status,
                        new_status,
                        verified_at: kyc_verified_at
                    });

                    if (wallet_blocked) {
                        await rabbitmq.publishEvent(`user.${player_id}.blocked`, {
                            player_id,
                            tenant_id,
                            type: 'PLAYER_BLOCKED',
                            reason: new_status,
                            blocked_at: new Date().toISOString()
                        });
                    }
                }
            }
        }

        res.status(result.status).json(result);
    } catch (error) {
        logger.error(`Failed to process Sumsub Webhook`, { error: error.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
