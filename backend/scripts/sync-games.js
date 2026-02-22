require('dotenv').config();
const GameService = require('../services/game-service');
const { logger } = require('../services/logger');

async function runSync() {
    try {
        logger.info('[Sync Script] Starting game metadata sync...');
        const result = await GameService.syncMetadata('1');
        logger.info('[Sync Script] Sync completed successfully:', result);
        process.exit(0);
    } catch (error) {
        logger.error('[Sync Script] Sync failed:', error);
        process.exit(1);
    }
}

runSync();
