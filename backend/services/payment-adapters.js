const { logger } = require('./logger');

/**
 * PaymentAdapters
 * Mock implementations for various payment service providers.
 */
class PaymentAdapters {

    static async call(provider, amount, userId) {
        logger.info(`[Adapter] Calling ${provider} for user ${userId}`, { amount });

        // Simulate network latency
        await new Promise(r => setTimeout(r, 500));

        switch (provider) {
            case 'Adyen':
            case 'Stripe':
                return this.mockGeneric(provider);
            case 'Trustly':
                return this.mockTrustly();
            case 'Skrill':
                return this.mockSkrill();
            case 'Coinbase':
                return this.mockCoinbase();
            default:
                throw new Error(`PROVIDER_NOT_SUPPORTED: ${provider}`);
        }
    }

    static mockGeneric(provider) {
        const failureChance = 0.05;
        if (Math.random() < failureChance) throw new Error(`${provider}_NETWORK_TIMEOUT`);
        return { status: 'Approved', provider };
    }

    static mockTrustly() {
        return {
            status: 'Approved',
            provider: 'Trustly',
            method: 'Open Banking',
            redirect_url: 'https://checkout.trustly.com/mock'
        };
    }

    static mockSkrill() {
        return { status: 'Approved', provider: 'Skrill', method: 'E-Wallet' };
    }

    static mockCoinbase() {
        return {
            status: 'Approved',
            provider: 'Coinbase',
            method: 'Crypto',
            tx_hash: '0x' + Math.random().toString(16).substr(2, 64)
        };
    }
}

module.exports = PaymentAdapters;
