const ProviderAdapter = require('./base');

/**
 * NetEnt Adapter
 * Implements the S2S Wallet integration for NetEnt
 */
class NetEntAdapter extends ProviderAdapter {
    constructor(config) {
        super(config);
    }

    /**
     * NetEnt often involves a static token or a dynamic session key
     */
    verifySignature(req) {
        const token = req.headers['authorization'];
        return token === `Bearer ${this.config.apiKey}`;
    }

    /**
     * Transforms NetEnt Debit Payload
     * Format: { playerId, transactionId, amount, gameName }
     */
    transformDebit(payload) {
        return {
            userId: payload.playerId,
            amount: payload.amount,
            operatorId: payload.operatorId,
            transactionId: payload.transactionId,
            metadata: {
                provider: 'NetEnt',
                gameId: payload.gameName,
                type: 'bet'
            }
        };
    }

    /**
     * Transforms NetEnt Credit Payload
     */
    transformCredit(payload) {
        return {
            userId: payload.playerId,
            amount: payload.amount,
            operatorId: payload.operatorId,
            transactionId: payload.transactionId,
            metadata: {
                provider: 'NetEnt',
                gameId: payload.gameName,
                type: 'win'
            }
        };
    }

    /**
     * NetEnt response format
     */
    formatResponse(result) {
        return {
            status: "SUCCESS",
            balance: result.balance,
            transactionId: result.transaction_id,
            currency: result.currency
        };
    }

    /**
     * NetEnt error format
     */
    formatError(error) {
        return {
            status: "FAILURE",
            errorCode: error.message === 'INSUFFICIENT_FUNDS' ? 'ERR_001' : 'ERR_999',
            description: error.message
        };
    }
}

module.exports = NetEntAdapter;
