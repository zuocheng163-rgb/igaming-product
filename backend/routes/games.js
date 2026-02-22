const express = require('express');
const router = express.Router();
const GameService = require('../services/game-service');
const { logger } = require('../services/logger');

/**
 * GET /api/v1/games/catalog
 * Returns paginated, filtered game metadata
 */
router.get('/catalog', async (req, res) => {
    try {
        const filters = {
            provider: req.query.provider,
            category: req.query.category,
            search: req.query.search,
            page: req.query.page,
            limit: req.query.limit
        };

        // In a real app, brand_id would come from auth/API key
        const brandId = req.headers['x-brand-id'] || '1';

        const catalog = await GameService.getCatalog(brandId, filters);
        res.json(catalog);
    } catch (error) {
        logger.error('[Games API] Catalog fetch failed:', error);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * POST /api/v1/games/:id/launch
 * Creates a signed game session URL
 */
router.post('/:id/launch', async (req, res) => {
    try {
        const gameId = req.params.id;
        const { player_id, mode } = req.body;
        const brandId = req.headers['x-brand-id'] || '1';

        if (!player_id) {
            return res.status(400).json({ error: 'MISSING_PLAYER_ID' });
        }

        const launchDetails = await GameService.launchGame(brandId, player_id, gameId, mode);
        res.json(launchDetails);
    } catch (error) {
        if (error.message === 'GAME_NOT_FOUND') {
            return res.status(404).json({ error: 'GAME_NOT_FOUND' });
        }
        if (error.message === 'PROVIDER_UNAVAILABLE') {
            return res.status(503).json({ error: 'PROVIDER_UNAVAILABLE' });
        }

        logger.error('[Games API] Launch failed:', error);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * POST /api/v1/games/sync
 * Manually trigger metadata sync (Protected in production)
 */
router.post('/sync', async (req, res) => {
    try {
        const brandId = req.headers['x-brand-id'] || '1';
        const result = await GameService.syncMetadata(brandId);
        res.json(result);
    } catch (error) {
        logger.error('[Games API] Sync failed:', error);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * GET /api/v1/games/admin/catalog
 * Returns the full game library with enablement status for the operator
 */
router.get('/admin/catalog', async (req, res) => {
    try {
        const brandId = req.headers['x-brand-id'] || '1';
        const catalog = await GameService.getAdminCatalog(brandId);
        res.json(catalog);
    } catch (error) {
        logger.error('[Games API] Admin catalog fetch failed:', error);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

/**
 * POST /api/v1/games/admin/toggle
 * Toggle game enablement status
 */
router.post('/admin/toggle', async (req, res) => {
    try {
        const { game_id, enabled } = req.body;
        const brandId = req.headers['x-brand-id'] || '1';

        if (!game_id) {
            return res.status(400).json({ error: 'MISSING_GAME_ID' });
        }

        const result = await GameService.toggleGame(brandId, game_id, enabled);
        res.json(result);
    } catch (error) {
        logger.error('[Games API] Game toggle failed:', error);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
});

module.exports = router;
