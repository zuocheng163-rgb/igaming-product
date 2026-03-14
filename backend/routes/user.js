const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const { logger } = require('../services/logger');

// Reuse authentication logic similar to operator.js but focused on player context
const authenticatePlayer = async (req, res, next) => {
    try {
        const sessionToken = req.headers['authorization']?.startsWith('Bearer ')
            ? req.headers['authorization'].slice(7)
            : req.headers['authorization'];
        const username = req.headers['x-username'];

        if (!sessionToken && !username) {
            return res.status(401).json({ error: 'Unauthorized: No token or username' });
        }

        const user = await supabaseService.getUser(username, sessionToken);
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid session' });
        }

        req.user = user;
        next();
    } catch (error) {
        logger.error('Player Auth Error', { error: error.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

router.use(authenticatePlayer);

/**
 * GET /api/user/recently-played
 */
router.get('/recently-played', async (req, res) => {
    try {
        const games = await supabaseService.getRecentlyPlayed(req.user.user_id);
        res.json({ games });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recently played games' });
    }
});

/**
 * GET /api/user/favourites
 */
router.get('/favourites', async (req, res) => {
    try {
        const games = await supabaseService.getUserFavourites(req.user.user_id);
        res.json({ games });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch favourites' });
    }
});

/**
 * POST /api/user/favourites/toggle
 */
router.post('/favourites/toggle', async (req, res) => {
    const { game_id } = req.body;
    if (!game_id) return res.status(400).json({ error: 'Missing game_id' });

    try {
        const result = await supabaseService.toggleFavourite(req.user.user_id, game_id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle favourite' });
    }
});

/**
 * POST /api/user/track-activity
 */
router.post('/track-activity', async (req, res) => {
    const { activity, game_id, metadata } = req.body;
    try {
        await supabaseService.trackActivity(req.user.user_id, activity, game_id, metadata);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to track activity' });
    }
});

/**
 * GET /api/user/transactions
 */
router.get('/transactions', async (req, res) => {
    try {
        const transactions = await supabaseService.getUserTransactions(req.user.user_id);
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

/**
 * GET /api/user/kyc-status
 */
router.get('/kyc-status', async (req, res) => {
    res.json({
        status: req.user.kyc_status || 'NOT_STARTED',
        level: req.user.kyc_level || 0,
        verified: req.user.kyc_status === 'VERIFIED'
    });
});

/**
 * POST /api/user/delete-account
 */
router.post('/delete-account', async (req, res) => {
    // In a real system, this would trigger a workflow.
    // Here we just log it as a request.
    logger.info(`Account deletion requested for user: ${req.user.user_id}`);
    res.json({ success: true, message: 'Deletion request received' });
});

/**
 * POST /api/user/consents
 */
router.post('/consents', async (req, res) => {
    const { consents } = req.body;
    try {
        await supabaseService.updateUser(req.user.id, { marketing_consents: consents });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update consents' });
    }
});

module.exports = router;
