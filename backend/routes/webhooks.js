const express = require('express');
const router = express.Router();
const InterventionService = require('../services/intervention');
const { logger, auditLog, generateCorrelationId } = require('../services/logger');

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
            operatorId: operator_id || 'default',
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

module.exports = router;
