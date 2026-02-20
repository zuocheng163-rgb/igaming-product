const ProviderAdapter = require('./base');

/**
 * Pragmatic Play Adapter
 * Implements the Seamless Wallet integration for Pragmatic Play
 */
class PragmaticPlayAdapter extends ProviderAdapter {
    constructor(config) {
        super(config);
    }

    /**
     * Pragmatic uses a MD5 or SHA256 hash usually
     */
    verifySignature(req) {
        // Mocking signature verification for now
        const hash = req.body.hash;
        return !!hash;
    }

    /**
     * Transforms Pragmatic Debit Payload
     * Pragmatic format uses 'userId', 'amount', 'reference'
     */
    transformDebit(payload) {
        return {
            userId: payload.userId,
            amount: payload.amount,
            operatorId: payload.operatorId,
            transactionId: payload.reference,
            metadata: {
                provider: 'PragmaticPlay',
                gameId: payload.gameId,
                roundId: payload.roundId,
                type: 'bet'
            }
        };
    }

    /**
     * Transforms Pragmatic Credit Payload
     */
    transformCredit(payload) {
        return {
            userId: payload.userId,
            amount: payload.amount,
            operatorId: payload.operatorId,
            transactionId: payload.reference,
            metadata: {
                provider: 'PragmaticPlay',
                gameId: payload.gameId,
                roundId: payload.roundId,
                type: 'win'
            }
        };
    }

    /**
     * Pragmatic response format
     */
    formatResponse(result) {
        return {
            error: 0,
            description: "Success",
            cash: result.balance,
            bonus: result.bonus_balance || 0,
            transactionId: result.transaction_id
        };
    }

    /**
     * Pragmatic error format
     */
    formatError(error) {
        return {
            error: error.message === 'INSUFFICIENT_FUNDS' ? 100 : 1,
            description: error.message
        };
    }
}

module.exports = PragmaticPlayAdapter;
