const supabaseService = require('./supabase');
const SlackService = require('./slack-service');
const rabbitmq = require('./rabbitmq');
const ftService = require('./ft-integration');
const { logger } = require('./logger');
const RGAuditService = require('./rg-audit-service');

/**
 * InterventionService
 * Executes protective actions when risky behavior is detected.
 */
class InterventionService {

    /**
     * Trigger a Reality Check or Affordability modal on the frontend
     */
    static async triggerRealityCheck(userId, reason, type = 'REALITY_CHECK', brandId = 1) {
        logger.info(`Triggering UI Intervention`, { userId, reason, type });

        const message = type === 'AFFORDABILITY_CHECK'
            ? 'We need to verify your affordability to continue. Please connect your bank.'
            : 'You have been playing for a while. Would you like to take a break?';

        // Log to DB for polling fallback
        await supabaseService.saveAuditLog({
            correlation_id: require('crypto').randomUUID(),
            level: 'warn',
            brand_id: brandId, // Ensure it shows up in Operator Portal stats
            actor_id: userId,
            action: 'user:alert',
            metadata: { type, message, reason },
            message: `Duty of Care Alert: ${type}`
        });

        if (rabbitmq && rabbitmq.publishEvent) {
            rabbitmq.publishEvent(`user.${userId}.alert`, {
                type,
                message,
                reason,
                timestamp: new Date().toISOString()
            });
        }

        await RGAuditService.log(brandId, userId, 'RG_REALITY_CHECK_SENT', { reason, type });
    }

    /**
     * Trigger a Mandatory Break (blocking overlay)
     */
    static async triggerMandatoryBreak(userId, durationHours, reason, brandId = 1) {
        logger.warn(`Triggering Mandatory Break`, { userId, durationHours, reason });

        const message = `To help you stay in control, we've initiated a mandatory break for ${durationHours} hour(s).`;
        
        await supabaseService.saveAuditLog({
            correlation_id: require('crypto').randomUUID(),
            level: 'error',
            brand_id: brandId,
            actor_id: userId,
            action: 'user:alert',
            metadata: { type: 'MANDATORY_BREAK', message, durationHours, reason },
            message: `Mandatory Break Triggered: ${reason}`
        });

        if (rabbitmq && rabbitmq.publishEvent) {
            rabbitmq.publishEvent(`user.${userId}.alert`, {
                type: 'MANDATORY_BREAK',
                message,
                durationHours,
                reason,
                timestamp: new Date().toISOString()
            });
        }

        await RGAuditService.log(brandId, userId, 'RG_MANDATORY_BREAK_TRIGGERED', { durationHours, reason });
    }

    /**
     * Log an EDD (Enhanced Due Diligence) prompt
     */
    static async logEDDPrompt(userId, reason, brandId = 1) {
        logger.info(`EDD Prompt Triggered`, { userId, reason });
        await RGAuditService.log(brandId, userId, 'RG_EDD_PENDING_SET', { reason });
        // Typically this would also notify the KYC team
    }

    /**
     * notifyCRM
     * Pushes a special risk event to Fast Track CRM
     */
    static async notifyCRM(userId, riskLevel, reasons) {
        logger.info(`Notifying CRM of Risky Behavior`, { userId, riskLevel });

        await ftService.pushEvent(userId, 'risk_flag', {
            risk_level: riskLevel,
            reasons: reasons,
            triggered_at: new Date().toISOString()
        });
    }

    /**
     * Suppress bonuses for a player
     */
    static async triggerBonusSuppression(userId, brandId = 1) {
        logger.warn(`Triggering Bonus Suppression`, { userId });

        const { error } = await supabaseService.client
            .from('player_profiles')
            .update({ bonus_suppressed: true })
            .eq('player_id', userId)
            .eq('tenant_id', brandId);

        if (error) throw error;

        await RGAuditService.log(brandId, userId, 'RG_BONUS_SUPPRESSED', { active: true });
    }

    /**
     * Remove bonus suppression
     */
    static async clearBonusSuppression(userId, brandId = 1) {
        logger.info(`Clearing Bonus Suppression`, { userId });

        await supabaseService.client
            .from('player_profiles')
            .update({ bonus_suppressed: false })
            .eq('player_id', userId)
            .eq('tenant_id', brandId);
        
        // Log "restoration" event if needed
    }


    /**
     * Apply a temporary restriction or alert
     */
    static async handleRiskDetected(userId, riskData, brandId = 1) {
        const { riskLevel, reasons, netLossTier } = riskData;

        // 1. Notify CRM immediately for all flags
        await this.notifyCRM(userId, riskLevel, reasons);

        // 2. Escalate Interventions
        if (netLossTier >= 3 || reasons.includes('isVelocitySpikeDetected')) {
            // High Risk -> Mandatory Break (24h)
            await this.triggerMandatoryBreak(userId, 24, reasons.join(', '), brandId);
        } else if (riskLevel === 'HIGH' || riskLevel === 'MEDIUM' || reasons.includes('isAffordabilityThresholdReached')) {
            const type = reasons.includes('isAffordabilityThresholdReached') ? 'AFFORDABILITY_CHECK' : 'REALITY_CHECK';
            await this.triggerRealityCheck(userId, reasons.join(', '), type, brandId);
        }

        // 3. Trigger EDD for Affordability or pattern risk
        if (reasons.includes('isAffordabilityThresholdReached') || reasons.includes('isRapidEscalationDetected')) {
            await this.logEDDPrompt(userId, reasons.join(', '), brandId);
        }

        // 4. Trigger Bonus Suppression for Advanced Tier high risk
        if (netLossTier >= 3 || reasons.includes('isVelocitySpikeDetected')) {
            await this.triggerBonusSuppression(userId, brandId);
        }

        // 5. Slack Integration: Notify for risk events
        await SlackService.sendRiskAlert(userId, riskData);

        // 5. Log to internal audit
        logger.warn(`AI Duty of Care Intervention Triggered`, { userId, riskLevel, reasons });
    }
}

module.exports = InterventionService;
