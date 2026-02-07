const { logger } = require('./logger');

/**
 * SimulatorService
 * Isolated home for all demo-specific logic and mock data.
 * This keeps the core production services (supabase.js, wallet-service.js) clean.
 */
class SimulatorService {

    /**
     * Mock User Data for Demo Mode
     */
    static getDemoUser(userIdOrUsername) {
        return {
            id: userIdOrUsername || 'demo-uuid',
            username: userIdOrUsername || 'demo_user',
            email: 'demo@neostrike.io',
            balance: 1000,
            bonus_balance: 500,
            currency: 'EUR',
            country: 'MT',
            operator_id: 'default'
        };
    }

    /**
     * Mock Consents
     */
    static getDemoConsents() {
        return {
            consents: [
                { id: 'marketing', status: true },
                { id: 'behavioral_analysis', status: true }
            ]
        };
    }

    /**
     * Mock Blocks
     */
    static getDemoBlocks() {
        return {
            blocks: []
        };
    }

    /**
     * Intercepts and handles demo-specific logic for middleware
     */
    static handleSandboxRequest(req, res) {
        const { method, path } = req;

        // 1. Mock User Details
        if (method === 'GET' && path.startsWith('/api/userdetails/')) {
            const userId = req.params.userid;
            return res.json(this.getDemoUser(userId));
        }

        // 2. Mock Registration
        if (method === 'POST' && path.includes('/register')) {
            const username = req.body.username || 'demo_user';
            const user = this.getDemoUser(username);
            return res.json({
                user_id: user.username,
                token: `token-${username}`,
                user: user
            });
        }

        // 3. Mock Profile Update
        if (method === 'POST' && path.includes('/user/update')) {
            return res.json({
                success: true,
                user: {
                    ...req.body,
                    user_id: req.user?.username || 'demo_user',
                    id: req.user?.id || 'demo-uuid'
                }
            });
        }

        // 4. Mock Consents & Blocks
        if (method === 'GET' && path.includes('/userconsents')) return res.json(this.getDemoConsents());
        if (method === 'GET' && path.includes('/userblocks')) return res.json(this.getDemoBlocks());

        if (method === 'PUT' && (path.includes('/userconsents') || path.includes('/userblocks'))) {
            return res.json({ success: true });
        }

        return null;
    }
}

module.exports = SimulatorService;
