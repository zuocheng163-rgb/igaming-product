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
     * Manually parses userId from path because req.params is not populated in global middleware.
     */
    static handleSandboxRequest(req, res) {
        const { method, path } = req;

        // 1. Mock User Details: GET /api/userdetails/:userid
        const userDetailsMatch = path.match(/\/api\/userdetails\/([^\/?#]+)/);
        if (method === 'GET' && userDetailsMatch) {
            const userId = userDetailsMatch[1];
            logger.info(`[Simulator] Mocking UserDetails for ${userId}`);
            res.json(this.getDemoUser(userId));
            return true;
        }

        // 2. Mock Registration: POST /api/register
        if (method === 'POST' && path.includes('/register')) {
            const username = req.body.username || 'demo_user';
            const user = this.getDemoUser(username);
            logger.info(`[Simulator] Mocking Registration for ${username}`);
            res.json({
                user_id: user.username,
                token: `token-${username}`,
                user: user
            });
            return true;
        }

        // 3. Mock Profile Update: POST /api/user/update
        if (method === 'POST' && path.includes('/user/update')) {
            logger.info(`[Simulator] Mocking User Update`);
            res.json({
                success: true,
                user: {
                    ...req.body,
                    user_id: req.user?.username || 'demo_user',
                    id: req.user?.id || 'demo-uuid'
                }
            });
            return true;
        }

        // 4. Mock Consents: GET/PUT /api/userconsents/:userid
        const consentsMatch = path.match(/\/api\/userconsents\/([^\/?#]+)/);
        if (consentsMatch) {
            if (method === 'GET') {
                logger.info(`[Simulator] Mocking GET UserConsents for ${consentsMatch[1]}`);
                res.json(this.getDemoConsents());
            } else if (method === 'PUT') {
                logger.info(`[Simulator] Mocking PUT UserConsents for ${consentsMatch[1]}`);
                res.json({ success: true });
            }
            return true;
        }

        // 5. Mock Blocks: GET/PUT /api/userblocks/:userid
        const blocksMatch = path.match(/\/api\/userblocks\/([^\/?#]+)/);
        if (blocksMatch) {
            if (method === 'GET') {
                logger.info(`[Simulator] Mocking GET UserBlocks for ${blocksMatch[1]}`);
                res.json(this.getDemoBlocks());
            } else if (method === 'PUT') {
                logger.info(`[Simulator] Mocking PUT UserBlocks for ${blocksMatch[1]}`);
                res.json({ success: true });
            }
            return true;
        }

        return false;
    }
}

module.exports = SimulatorService;
