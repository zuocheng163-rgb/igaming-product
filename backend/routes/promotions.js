const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const { logger } = require('../services/logger');

/**
 * GET /api/promotions/active
 * Returns all active promotions for the brand.
 */
router.get('/active', async (req, res) => {
    try {
        const promotions = await supabaseService.getActivePromotions(1); // Default brand 1
        res.json({ promotions });
    } catch (error) {
        logger.error('[Promotions API] Failed to fetch active promotions', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch active promotions' });
    }
});

module.exports = router;
