const { logger } = require('./logger');

/**
 * PaymentRoutingService
 * Dynamically determines the best sequence of payment providers.
 */
class PaymentRoutingService {

    // Static configuration for geographic preferences
    static ROUTING_MAP = {
        'UK': ['Trustly', 'Adyen', 'Stripe'],
        'BR': ['Skrill', 'Adyen'],
        'US': ['Coinbase', 'Stripe'],
        'MT': ['Adyen', 'Trustly', 'Stripe']
    };

    static DEFAULT_SEQUENCE = ['Adyen', 'Stripe'];

    /**
     * Get the best provider sequence for a user's location
     * @param {string} countryCode ISO 2-letter country code
     * @param {number} amount
     */
    static getProviderSequence(countryCode, amount) {
        logger.info(`Calculating routing sequence for geo: ${countryCode}`, { amount });

        let sequence = [...(this.ROUTING_MAP[countryCode] || this.DEFAULT_SEQUENCE)];

        // Smart Logic: If amount > 5000, prioritize bank-based methods (Trustly)
        if (amount > 5000) {
            sequence = ['Trustly', ...sequence.filter(p => p !== 'Trustly')];
        }

        return sequence;
    }
}

module.exports = PaymentRoutingService;
