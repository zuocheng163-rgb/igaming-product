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

    /**
     * Get Evolution Game Metadata
     */
    async getMetadata() {
        return [
            {
                id: 'evolution:lightning-roulette',
                name: 'Lightning Roulette',
                provider: 'evolution',
                category: 'live-casino',
                thumbnail: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
                rtp: 97.3,
                min_bet: 0.20,
                max_bet: 5000.00,
                has_demo: false,
                tags: ['roulette', 'live', 'featured']
            },
            {
                id: 'evolution:crazy-time',
                name: 'Crazy Time',
                provider: 'evolution',
                category: 'live-casino',
                thumbnail: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=400&q=80',
                rtp: 96.08,
                min_bet: 0.10,
                max_bet: 2500.00,
                has_demo: false,
                tags: ['game-show', 'live', 'featured']
            }
        ];
    }

    /**
     * Launch Evolution Game
     */
    async launch(playerId, gameId, mode) {
        const sessionId = `evo_session_${Math.random().toString(36).substr(2, 9)}`;
        return {
            game_url: `https://game.evolution.com/frontend/evo/r2?token=${sessionId}&playerId=${playerId}&gameId=${gameId}&mode=${mode}`,
            session_id: sessionId,
            expires_at: new Date(Date.now() + 3600000).toISOString()
        };
    }
}

module.exports = EvolutionAdapter;
