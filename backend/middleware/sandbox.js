const { logger } = require('../services/logger');
const SimulatorService = require('../services/simulator-service');

/**
 * SandboxMode Middleware
 * Bypasses real database/CRM calls when 'x-sandbox-mode' header is present
 * or when process.env.DEMO_MODE is enabled.
 */
const sandboxMiddleware = (req, res, next) => {
    const isSandbox = req.headers['x-sandbox-mode'] === 'true' || process.env.DEMO_MODE === 'true';

    if (isSandbox) {
        req.isSandbox = true;

        // Skip noisy logs for heartbeats
        if (!req.path.includes('/stats/') && !req.path.includes('/balance')) {
            logger.info(`[Sandbox] Intercepting request: ${req.method} ${req.path}`);
        }

        // Delegate all mock handling to SimulatorService
        const handled = SimulatorService.handleSandboxRequest(req, res);
        if (handled === true) return;

        // If not handled by simulator (like wallet actions), flag for service-level mocking
        if (req.method === 'POST' && (req.path.includes('/debit') || req.path.includes('/credit') || req.path.includes('/deposit'))) {
            req.useMockData = true;
            logger.info(`[Sandbox] Flagging request for service-level mocking: ${req.path}`);
        }
    }

    next();
};

module.exports = sandboxMiddleware;
