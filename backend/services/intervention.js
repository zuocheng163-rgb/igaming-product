const SlackService = require('./slack-service');
const rabbitmq = require('./rabbitmq');
const ftService = require('./ft-integration');
const { logger } = require('./logger');

/**
 * InterventionService
 * Executes protective actions when risky behavior is detected.
 */
class InterventionService {

    /**
     * Trigger a Reality Check or Affordability modal on the frontend
     */
    static triggerRealityCheck(userId, reason, type = 'REALITY_CHECK') {
        logger.info(`Triggering UI Intervention`, { userId, reason, type });

        const message = type === 'AFFORDABILITY_CHECK'
            ? 'We need to verify your affordability to continue. Please connect your bank.'
            : 'You have been playing for a while. Would you like to take a break?';

        rabbitmq.publishEvent(`user.${userId}.alert`, {
            type,
            message,
            reason,
            timestamp: new Date().toISOString()
        });
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
     * Apply a temporary restriction or alert
     */
    static async handleRiskDetected(userId, riskData) {
        const { riskLevel, reasons } = riskData;

        // 1. Notify CRM immediately for all flags
        await this.notifyCRM(userId, riskLevel, reasons);

        // 2. High Risk or Affordability: Force UI Interaction
        if (riskLevel === 'HIGH' || reasons.includes('isAffordabilityThresholdReached')) {
            const type = reasons.includes('isAffordabilityThresholdReached') ? 'AFFORDABILITY_CHECK' : 'REALITY_CHECK';
            this.triggerRealityCheck(userId, reasons.join(', '), type);
        }

        // 3. Slack Integration: Notify for risk events
        await SlackService.sendRiskAlert(userId, riskData);

        // 4. Log to internal audit
        logger.warn(`AI Duty of Care Intervention Triggered`, { userId, riskLevel, reasons });
    }
}

module.exports = InterventionService;
