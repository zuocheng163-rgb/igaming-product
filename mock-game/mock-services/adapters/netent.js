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

    /**
     * Get NetEnt Game Metadata
     */
    async getMetadata() {
        return [
            {
                id: 'netent:starburst',
                name: 'Starburst',
                provider: 'netent',
                category: 'slots',
                thumbnail: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&q=80',
                rtp: 96.09,
                min_bet: 0.10,
                max_bet: 100.00,
                has_demo: true,
                tags: ['featured', 'slots', 'classic']
            },
            {
                id: 'netent:gonzos-quest',
                name: "Gonzo's Quest",
                provider: 'netent',
                category: 'slots',
                thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
                rtp: 95.97,
                min_bet: 0.20,
                max_bet: 50.00,
                has_demo: true,
                tags: ['slots', 'adventure']
            },
            {
                id: 'netent:divine-fortune',
                name: 'Divine Fortune',
                provider: 'netent',
                category: 'slots',
                thumbnail: 'https://images.unsplash.com/photo-1567596275753-92607c3ce1ae?w=400&q=80',
                rtp: 96.59,
                min_bet: 0.20,
                max_bet: 100.00,
                has_demo: true,
                tags: ['slots', 'jackpot']
            }
        ];
    }

    /**
     * Launch NetEnt Game
     */
    async launch(playerId, gameId, mode) {
        const sessionId = `netent_session_${Math.random().toString(36).substr(2, 9)}`;
        return {
            game_url: `https://game.netent.com/launch?playerId=${playerId}&gameId=${gameId}&mode=${mode}&token=${sessionId}`,
            session_id: sessionId,
            expires_at: new Date(Date.now() + 3600000).toISOString()
        };
    }
}

module.exports = NetEntAdapter;
