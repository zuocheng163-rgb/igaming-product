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

    /**
     * Get Pragmatic Play Game Metadata
     */
    async getMetadata() {
        return [
            {
                id: 'pragmatic:gates-of-olympus',
                name: 'Gates of Olympus',
                provider: 'pragmatic',
                category: 'slots',
                thumbnail: 'https://images.unsplash.com/photo-1633356122102-3fe601e05bd2?w=400&q=80',
                rtp: 96.50,
                min_bet: 0.20,
                max_bet: 100.00,
                has_demo: true,
                tags: ['featured', 'high-volatility', 'slots']
            },
            {
                id: 'pragmatic:sweet-bonanza',
                name: 'Sweet Bonanza',
                provider: 'pragmatic',
                category: 'slots',
                thumbnail: 'https://images.unsplash.com/photo-1561736778-92e52a7769ef?w=400&q=80',
                rtp: 96.48,
                min_bet: 0.20,
                max_bet: 125.00,
                has_demo: true,
                tags: ['featured', 'slots']
            },
            {
                id: 'pragmatic:wolf-gold',
                name: 'Wolf Gold',
                provider: 'pragmatic',
                category: 'slots',
                thumbnail: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&q=80',
                rtp: 96.01,
                min_bet: 0.25,
                max_bet: 125.00,
                has_demo: true,
                tags: ['slots', 'jackpot']
            }
        ];
    }

    /**
     * Launch Pragmatic Play Game
     */
    async launch(playerId, gameId, mode) {
        const sessionId = `pragmatic_session_${Math.random().toString(36).substr(2, 9)}`;
        return {
            game_url: `https://game.pragmaticplay.net/gs2c/playGame.do?key=${sessionId}&playerId=${playerId}&gameId=${gameId}&mode=${mode}`,
            session_id: sessionId,
            expires_at: new Date(Date.now() + 3600000).toISOString()
        };
    }
}

module.exports = PragmaticPlayAdapter;
