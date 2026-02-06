/**
 * Base Provider Adapter Class
 * All game provider adapters (Evolution, Pragmatic, etc.) should extend this class.
 */
class ProviderAdapter {
    constructor(config) {
        this.providerName = config.providerName;
        this.config = config;
    }

    /**
     * Verify the signature/auth of the incoming request
     * @param {Object} req - Express request object
     * @returns {Boolean}
     */
    verifySignature(req) {
        throw new Error(`verifySignature not implemented for ${this.providerName}`);
    }

    /**
     * Standardize the incoming debit (bet) request
     * @param {Object} payload - Raw provider payload
     * @returns {Object} NeoStrike standardized debit object
     */
    transformDebit(payload) {
        throw new Error(`transformDebit not implemented for ${this.providerName}`);
    }

    /**
     * Standardize the incoming credit (win) request
     * @param {Object} payload - Raw provider payload
     * @returns {Object} NeoStrike standardized credit object
     */
    transformCredit(payload) {
        throw new Error(`transformCredit not implemented for ${this.providerName}`);
    }

    /**
     * Handle the response back to the provider in their specific format
     * @param {Object} result - NeoStrike wallet operation result
     * @returns {Object} Provider-formatted response
     */
    formatResponse(result) {
        throw new Error(`formatResponse not implemented for ${this.providerName}`);
    }

    /**
     * Handle error response back to the provider
     * @param {Error} error - The error caught during processing
     * @returns {Object} Provider-formatted error response
     */
    formatError(error) {
        return {
            status: 'ERROR',
            message: error.message
        };
    }
}

module.exports = ProviderAdapter;
