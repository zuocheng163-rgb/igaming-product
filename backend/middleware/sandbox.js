const { logger } = require('../services/logger');

/**
 * SandboxMode Middleware
 * Bypasses real database/CRM calls when 'x-sandbox-mode' header is present.
 * Useful for frontend developers and third-party integrators.
 */
const sandboxMiddleware = (req, res, next) => {
    const isSandbox = req.headers['x-sandbox-mode'] === 'true';

    if (isSandbox) {
        req.isSandbox = true;
        logger.info(`[Sandbox] Intercepting request: ${req.method} ${req.path}`);

        // Example: Mocking user details for GET /userdetails/:userid
        if (req.method === 'GET' && req.path.startsWith('/userdetails/')) {
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

        // Example: Mocking wallet success
        if (req.method === 'POST' && (req.path.includes('/debit') || req.path.includes('/credit'))) {
            return res.json({
                transaction_id: req.body.transaction_id || `sbx-${Date.now()}`,
                balance: 4900,
                currency: 'EUR'
            });
        }
    }

    next();
};

module.exports = sandboxMiddleware;
