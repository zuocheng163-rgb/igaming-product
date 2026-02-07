const { logger } = require('./logger');

/**
 * SimulatorService
 * Isolated home for all demo-specific logic and mock data.
 * This keeps the core production services (supabase.js, wallet-service.js) clean.
 */
class SimulatorService {

    /**
     * Mock User Data for Demo Mode (FT Compliant)
     */
    static getDemoUser(userIdOrUsername) {
        const username = userIdOrUsername || 'demo_user';
        return {
            // Database IDs
            id: '550e8400-e29b-41d4-a716-446655440000', // Example fixed UUID
            brand_id: 1,
            user_id: username,

            // Core Identity
            username: username,
            first_name: 'Jane',
            last_name: 'Doe',
            email: 'demo@neostrike.io',
            title: 'Ms',
            sex: 'female',
            birth_date: '1992-05-15',

            // Financials
            balance: 1000,
            bonus_balance: 500,
            currency: 'EUR',

            // Localization & Contact
            language: 'en',
            country: 'MT',
            city: 'Sliema',
            address: 'Triq It-Torri 123',
            postal_code: 'SLM 1010',
            mobile: '79123456',
            mobile_prefix: '356',
            full_mobile_number: '35679123456',

            // Operational Metadata
            registration_date: '2026-01-01T12:00:00Z',
            verified_at: '2026-01-01T14:00:00Z',
            origin: 'Web/Direct',
            market: 'International',
            registration_code: 'FASTTRACK2026',
            affiliate_reference: 'AFF_001',
            is_blocked: false,
            is_excluded: false,
            is_enabled: true,
            roles: ['PLAYER'],
            operator_id: 'sandbox'
        };
    }

    /**
     * Mock Consents (FT Compliant Array Format)
     */
    static getDemoConsents() {
        return [
            { type: 'email', opted_in: true },
            { type: 'sms', opted_in: true },
            { type: 'telephone', opted_in: false },
            { type: 'postMail', opted_in: false },
            { type: 'siteNotification', opted_in: true },
            { type: 'pushNotification', opted_in: true }
        ];
    }

    /**
     * Mock Blocks (FT Compliant Format)
     */
    static getDemoBlocks() {
        return {
            blocked: false,
            excluded: false,
            last_modified: '2026-02-07T10:00:00Z'
        };
    }

    /**
     * Intercepts and handles demo-specific logic for middleware
     */
    static handleSandboxRequest(req, res) {
        const { method, path: reqPath } = req;

        // Normalize path for matching
        const path = reqPath.startsWith('/') ? reqPath : '/' + reqPath;

        // 1. Mock User Details: (GET) /api/userdetails/:userid
        const userDetailsMatch = path.match(/\/(?:api\/)?userdetails\/([^\/?#]+)/i);
        if (method === 'GET' && userDetailsMatch) {
            const userId = userDetailsMatch[1];
            logger.info(`[Simulator] Match: UserDetails for ${userId}`);
            res.json(this.getDemoUser(userId));
            return true;
        }

        // 2. Mock Registration: (POST) /api/register
        if (method === 'POST' && (path.endsWith('/register') || path.includes('/register'))) {
            const username = req.body.username || 'demo_user';
            const user = this.getDemoUser(username);
            logger.info(`[Simulator] Match: Registration for ${username}`);
            res.json({
                user_id: user.username,
                token: `token-${username}`,
                user: user
            });
            return true;
        }

        // 3. Mock Profile Update
        if (method === 'POST' && (path.endsWith('/user/update') || path.includes('/user/update'))) {
            logger.info(`[Simulator] Match: User Update`);
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

        // 4. Mock Consents: (GET/PUT) /api/userconsents/:userid
        const consentsMatch = path.match(/\/(?:api\/)?userconsents\/([^\/?#]+)/i);
        if (consentsMatch) {
            const userId = consentsMatch[1];
            if (method === 'GET') {
                logger.info(`[Simulator] Match: GET UserConsents for ${userId}`);
                res.json(this.getDemoConsents());
            } else if (method === 'PUT') {
                logger.info(`[Simulator] Match: PUT UserConsents for ${userId}`);
                res.json({ success: true });
            }
            return true;
        }

        // 5. Mock Blocks: (GET/PUT) /api/userblocks/:userid
        const blocksMatch = path.match(/\/(?:api\/)?userblocks\/([^\/?#]+)/i);
        if (blocksMatch) {
            const userId = blocksMatch[1];
            if (method === 'GET') {
                logger.info(`[Simulator] Match: GET UserBlocks for ${userId}`);
                res.json(this.getDemoBlocks());
            } else if (method === 'PUT') {
                logger.info(`[Simulator] Match: PUT UserBlocks for ${userId}`);
                res.json({ success: true });
            }
            return true;
        }

        return false;
    }
}

module.exports = SimulatorService;
