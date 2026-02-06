const ProviderAdapter = require('./base');

/**
 * Evolution Gaming Adapter
 * Implements the Seamless Wallet API for Evolution
 */
class EvolutionAdapter extends ProviderAdapter {
    constructor(config) {
        super(config);
    }

    /**
     * Evolution usually uses an API Key or IP Whitelisting
     * Simplified signature check for now
     */
    verifySignature(req) {
        const apiKey = req.headers['x-api-key'];
        // In production, we would also verify a hash of the body
        return apiKey === this.config.apiKey;
    }

    /**
     * Transforms Evolution Debit Payload
     * Example Evolution Payload:
     * {
     *   "userId": "user_123",
     *   "transactionId": "evo_tx_999",
     *   "amount": 10.5,
     *   "gameId": "roulette_1",
     *   "operatorId": "op_001"
     * }
     */
    transformDebit(payload) {
        return {
            userId: payload.userId,
            amount: payload.amount,
            operatorId: payload.operatorId,
            transactionId: payload.transactionId,
            metadata: {
                provider: 'Evolution',
                gameId: payload.gameId,
                roundId: payload.roundId || payload.transactionId,
                type: 'bet'
            }
        };
    }

    /**
     * Transforms Evolution Credit Payload
     */
    transformCredit(payload) {
        return {
            userId: payload.userId,
            amount: payload.amount,
            operatorId: payload.operatorId,
            transactionId: payload.transactionId,
            metadata: {
                provider: 'Evolution',
                gameId: payload.gameId,
                roundId: payload.roundId || payload.transactionId,
                type: 'win'
            }
        };
    }

    /**
     * Evolution expects balance back in a specific format
     */
    formatResponse(result) {
        return {
            status: 'OK',
            balance: result.balance,
            bonusBalance: result.bonus_balance || 0,
            uuid: result.transaction_id
        };
    }

    /**
     * Evolution specific error formats
     */
    formatError(error) {
        const errorCodeMap = {
            'INSUFFICIENT_FUNDS': 'INSUFFICIENT_FUNDS',
            'USER_NOT_FOUND': 'INVALID_USER'
        };

        return {
            status: 'ERROR',
            code: errorCodeMap[error.message] || 'INTERNAL_ERROR',
            message: error.message
        };
    }
}

module.exports = EvolutionAdapter;
