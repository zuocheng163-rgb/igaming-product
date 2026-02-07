const { logger } = require('../services/logger');

/**
 * SandboxMode Middleware
 * Bypasses real database/CRM calls when 'x-sandbox-mode' header is present
 * or when process.env.DEMO_MODE is enabled.
 */
const sandboxMiddleware = (req, res, next) => {
    const isSandbox = req.headers['x-sandbox-mode'] === 'true' || process.env.DEMO_MODE === 'true';

    if (isSandbox) {
        req.isSandbox = true;

        // Don't log every single heartbeat/poll in demo mode to keep logs clean
        if (!req.path.includes('/stats/') && !req.path.includes('/balance')) {
            logger.info(`[Sandbox] Intercepting request: ${req.method} ${req.path}`);
        }

        // 1. Mock User Details
        if (req.method === 'GET' && req.path.startsWith('/api/userdetails/')) {
            return res.json({
                user_id: req.params.userid,
                username: `sandbox_user_${req.params.userid}`,
                email: 'sandbox@neostrike.io',
                balance: 5000,
                currency: 'EUR',
                country: 'MT',
                operator_id: 'sandbox_operator'
            });
        }

        // 2. Mock Wallet Actions - We NO LONGER return early here!
        // We let next() continue to the route handler so WalletService can push events to FT.
        // The services themselves will handle the DB fallback if DEMO_MODE is on.
        if (req.method === 'POST' && (req.path.includes('/debit') || req.path.includes('/credit') || req.path.includes('/deposit'))) {
            req.useMockData = true;
            logger.info(`[Sandbox] Flagging request for service-level mocking: ${req.path}`);
        }

        // 3. Mock Registration
        if (req.method === 'POST' && req.path.includes('/register')) {
            const username = req.body.username || 'demo_user';
            return res.json({
                user_id: `u-${Date.now()}`,
                token: `token-${username}`,
                user: {
                    id: `u-${Date.now()}`,
                    username: username,
                    balance: 1000,
                    currency: 'EUR'
                }
            });
        }

        // 4. Mock Profile Update
        if (req.method === 'POST' && req.path.includes('/user/update')) {
            return res.json({
                success: true,
                user: {
                    ...req.body,
                    user_id: req.user?.id || 'demo_id',
                    id: req.user?.id || 'demo_id'
                }
            });
        }

        // 5. Mock Consents & Blocks
        if (req.method === 'PUT' && (req.path.includes('/userconsents') || req.path.includes('/userblocks'))) {
            return res.json({ success: true });
        }
    }

    next();
};

module.exports = sandboxMiddleware;
