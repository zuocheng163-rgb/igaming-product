const { logger, auditLog } = require('./logger');

/**
 * PaymentAnalyticsService
 * Tracks and reports on payment provider performance.
 */
class PaymentAnalyticsService {

    /**
     * Log a payment attempt result for analytics
     */
    static async logAttempt(provider, status, amount, latency, userId, country) {
        logger.info(`[Analytics] Payment ${status}`, { provider, amount, latency });

        // In production, we'd write to a dedicated analytics table or Prometheus
        await auditLog({
            actor_id: userId,
            action: `payment:analytics:${status}`,
            entity_type: 'payment_provider',
            entity_id: provider,
            status: status === 'Approved' ? 'success' : 'error',
            metadata: { provider, amount, latency, country },
            message: `Payment orchestration analytics: ${provider} - ${status}`
        });
    }

    /**
     * Get provider success rates (Mock)
     */
    static getProviderStats() {
        return {
            'Adyen': { success_rate: 0.7, avg_latency: 450 },
            'Stripe': { success_rate: 0.95, avg_latency: 520 },
            'Trustly': { success_rate: 0.98, avg_latency: 1200 },
            'Skrill': { success_rate: 0.96, avg_latency: 300 }
        };
    }
}

module.exports = PaymentAnalyticsService;
