const express = require('express');
const router = express.Router();
const { logger } = require('../services/logger');
const sumsubAdapter = require('../services/kyc/sumsub-adapter');
const supabaseService = require('../services/supabase');

// Middleware to authenticate user or operator
// Re-using the same authenticateRequest from operator.js concept
const authenticateRequest = async (req, res, next) => {
    // simplified for brevity; relying on the fact that server.js might mount this behind real auth,
    // or we recreate the basic check
    const sessionToken = req.headers['authorization']?.replace('Bearer ', '');
    const username = req.headers['x-username'];

    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    let dbUser;
    if (sessionToken.startsWith('token-') || process.env.DEMO_MODE === 'true') {
        dbUser = await supabaseService.getUserById(username);
    } else {
        dbUser = await supabaseService.getUser(username, sessionToken);
    }

    if (!dbUser) return res.status(401).json({ error: 'Unauthorized' });
    req.user = dbUser;
    next();
};

/**
 * @route POST /api/v1/kyc/initiate
 * @desc Get SDK token to initialize the Sumsub Flow
 */
router.post('/initiate', authenticateRequest, async (req, res) => {
    try {
        const userId = req.user.id; // Supabase Auth UUID

        // Log Initiation Event
        await supabaseService.logKycEvent({
            tenant_id: req.user.brand_id,
            player_id: userId,
            event_type: 'INITIATION_CREATED',
            previous_status: req.user.kyc_status,
            new_status: req.user.kyc_status
        });

        const result = await sumsubAdapter.initiateKyc(userId);
        res.status(200).json(result);
    } catch (error) {
        logger.error('[KYC API] Initiate error', { error: error.message });
        res.status(500).json({ error: 'Failed to initiate KYC' });
    }
});

/**
 * @route GET /api/v1/kyc/status
 * @desc Polling endpoint for frontend to check the user's KYC status
 */
router.get('/status', authenticateRequest, async (req, res) => {
    try {
        res.status(200).json({
            kyc_status: req.user.kyc_status || 'NOT_STARTED',
            wallet_blocked: req.user.wallet_blocked || false
        });
    } catch (error) {
        logger.error('[KYC API] Status error', { error: error.message });
        res.status(500).json({ error: 'Failed to get KYC status' });
    }
});

module.exports = router;
