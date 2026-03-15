const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const { logger } = require('../services/logger');

// Reuse authentication logic similar to operator.js but focused on player context
const authenticatePlayer = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'] || '';
        
        // Recursive Bearer stripping to handle accidentally doubled prefixes
        let sessionToken = authHeader;
        while (sessionToken.toLowerCase().startsWith('bearer ')) {
            sessionToken = sessionToken.substring(7).trim();
        }
        
        const username = req.headers['x-username'];

        logger.info('[Auth Trace] Player request', { 
            path: req.path,
            hasAuth: !!authHeader,
            hasUsername: !!username,
            tokenPrefix: sessionToken?.substring(0, 10)
        });

        if (!sessionToken && !username) {
            logger.warn('[Auth] Rejected: No token or username');
            return res.status(401).json({ error: 'Unauthorized: No token or username' });
        }

        let user = await supabaseService.getUser(username, sessionToken);

        // Demo/Sandbox Mode Fallback (JIT User Creation)
        const isDemo = process.env.DEMO_MODE === 'true';
        // Sandbox is active if explicitly requested, if demo mode is on, OR if the token looks like a test token
        const isSandbox = req.headers['x-sandbox-mode'] === 'true' || isDemo || (sessionToken && sessionToken.startsWith('token-'));

        if (!user && isSandbox && (sessionToken?.startsWith('token-') || username)) {
            let targetUsername = username;
            if (!targetUsername && sessionToken?.startsWith('token-')) {
                // Best effort extraction: remove 'token-' and strip timestamp if it looks like one
                const raw = sessionToken.replace('token-', '');
                targetUsername = raw.split('-')[0];
            }

            if (targetUsername) {
                logger.info('[Auth] Player Sandbox Fallback: Resolving user', { targetUsername });
                user = await supabaseService.getUserById(targetUsername);

                if (!user) {
                    logger.info('[Auth] Player Sandbox: User not found, creating JIT user', { targetUsername });
                    try {
                        user = await supabaseService.createUser({
                            username: targetUsername,
                            email: `${targetUsername}@example.com`,
                            token: sessionToken,
                            brand_id: 1,
                            roles: ['PLAYER']
                        });
                        
                        await supabaseService.upsertPlayerProfile({
                            player_id: user.id,
                            tenant_id: '1',
                            email: `${targetUsername}@example.com`,
                            display_name: targetUsername
                        });
                    } catch (e) {
                        logger.error('[Auth] Player JIT Creation Failed', { error: e.message });
                        // Last resort fallback (non-persistent but allows request to proceed if valid enough)
                        user = { id: targetUsername, username: targetUsername, brand_id: 1 };
                    }
                }
            }
        }

        if (!user) {
            logger.warn('[Auth] Player Unauthorized Access', { 
                username, 
                hasToken: !!sessionToken,
                isSandbox,
                tokenPrefix: sessionToken?.substring(0, 8),
                isDemo
            });
            return res.status(401).json({ 
                error: 'Unauthorized: Invalid session',
                debug: isSandbox ? 'Sandbox active but user resolution failed' : 'Production auth failed. Check if user exists in DB with this token.',
                received_token_prefix: sessionToken?.substring(0, 8)
            });
        }

        // Ensure we handle both 'id' and 'user_id' fields consistently (UUID vs Login name)
        const userIdForQuery = user.user_id || user.username || user.id;
        req.user = { ...user, user_id: userIdForQuery };
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
