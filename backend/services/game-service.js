const { client: supabase } = require('./supabase');
const EvolutionAdapter = require('../../mock-game/mock-services/adapters/evolution');
const PragmaticPlayAdapter = require('../../mock-game/mock-services/adapters/pragmatic');
const NetEntAdapter = require('../../mock-game/mock-services/adapters/netent');
const { logger } = require('./logger');

// Initialize adapters
const adapters = {
    evolution: new EvolutionAdapter({
        providerName: 'Evolution',
        apiKey: process.env.EVOLUTION_API_KEY
    }),
    pragmatic: new PragmaticPlayAdapter({
        providerName: 'PragmaticPlay',
        apiKey: process.env.PRAGMATIC_API_KEY
    }),
    netent: new NetEntAdapter({
        providerName: 'NetEnt',
        apiKey: process.env.NETENT_API_KEY
    })
};

class GameService {
    /**
     * Sync game metadata from providers to games_master
     */
    static async syncMetadata(brandId = '1') {
        const startTime = Date.now();
        let gamesAdded = 0;
        let gamesUpdated = 0;
        const results = [];

        for (const [providerKey, adapter] of Object.entries(adapters)) {
            try {
                logger.info(`[GameService] Syncing metadata for ${providerKey}`);
                const games = await adapter.getMetadata();

                for (const game of games) {
                    const { data, error } = await supabase
                        .from('games_master')
                        .upsert({
                            id: game.id,
                            provider: game.provider,
                            name: game.name,
                            category: game.category,
                            thumbnail: game.thumbnail,
                            rtp: game.rtp,
                            min_bet: game.min_bet,
                            max_bet: game.max_bet,
                            has_demo: game.has_demo,
                            tags: game.tags,
                            last_synced_at: new Date().toISOString()
                        }, { onConflict: 'id' })
                        .select();

                    if (error) {
                        logger.error(`[GameService] Failed to sync game ${game.id}: ${error.message}`);
                    } else {
                        // In a real system we'd track if it's new or updated
                        gamesUpdated++;
                    }
                }

                results.push({ provider: providerKey, status: 'success', count: games.length });
            } catch (error) {
                logger.error(`[GameService] Sync failed for ${providerKey}: ${error.message}`);
                results.push({ provider: providerKey, status: 'failed', error: error.message });
            }
        }

        // Log sync results
        await supabase.from('game_sync_logs').insert(results.map(r => ({
            brand_id: brandId,
            provider: r.provider,
            games_added: r.status === 'success' ? r.count : 0,
            duration_ms: Date.now() - startTime,
            status: r.status,
            error_message: r.error
        })));

        return {
            success: true,
            duration_ms: Date.now() - startTime,
            results
        };
    }

    /**
     * Get Game Catalog for a tenant
     */
    static async getCatalog(brandId, filters = {}) {
        const { provider, category, search, page = 1, limit = 50 } = filters;

        // Step 1: Fetch disabled game IDs for this brand
        const { data: configs } = await supabase
            .from('tenant_game_config')
            .select('game_id, enabled')
            .eq('brand_id', brandId);

        const disabledGameIds = new Set(
            (configs || [])
                .filter(c => c.enabled === false)
                .map(c => c.game_id)
        );

        // Step 2: Fetch games from master table
        let query = supabase
            .from('games_master')
            .select('*', { count: 'exact' });

        if (provider) {
            const providers = provider.split(',');
            query = query.in('provider', providers);
        }

        if (category) {
            query = query.eq('category', category);
        }

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to).order('name');

        const { data, error, count } = await query;

        if (error) {
            logger.error(`[GameService] Failed to fetch catalog: ${error.message}`);
            throw error;
        }

        // Step 3: Filter out explicitly disabled games for this tenant
        const activeGames = (data || []).filter(game => !disabledGameIds.has(game.id));

        return {
            games: activeGames,
            total: count,
            page: parseInt(page),
            limit: parseInt(limit)
        };
    }

    /**
     * Launch a game
     */
    static async launchGame(brandId, playerId, gameId, mode = 'real') {
        // 1. Check if game is enabled for this tenant
        const { data: config, error: configError } = await supabase
            .from('tenant_game_config')
            .select('enabled')
            .eq('brand_id', brandId)
            .eq('game_id', gameId)
            .single();

        if (config && config.enabled === false) {
            throw new Error('GAME_NOT_FOUND');
        }

        // 2. Get game details to identify provider
        const { data: game, error: gameError } = await supabase
            .from('games_master')
            .select('provider')
            .eq('id', gameId)
            .single();

        if (gameError || !game) {
            throw new Error('GAME_NOT_FOUND');
        }

        const adapter = adapters[game.provider];
        if (!adapter) {
            throw new Error('PROVIDER_UNAVAILABLE');
        }

        // 3. Call adapter to get launch URL
        try {
            return await adapter.launch(playerId, gameId, mode);
        } catch (error) {
            logger.error(`[GameService] Launch failed for ${gameId}: ${error.message}`);
            throw new Error('PROVIDER_UNAVAILABLE');
        }
    }

    /**
     * Get full Game Catalog for administration
     */
    static async getAdminCatalog(brandId) {
        const { data, error } = await supabase
            .from('games_master')
            .select(`
                *,
                tenant_game_config!left(enabled)
            `)
            .order('name');

        if (error) {
            logger.error(`[GameService] Failed to fetch admin catalog: ${error.message}`);
            throw error;
        }

        return data.map(game => ({
            ...game,
            enabled: game.tenant_game_config?.[0]?.enabled ?? false,
            tenant_game_config: undefined
        }));
    }

    /**
     * Toggle game status for a tenant
     */
    static async toggleGame(brandId, gameId, enabled) {
        const { error } = await supabase
            .from('tenant_game_config')
            .upsert({
                brand_id: brandId,
                game_id: gameId,
                enabled,
                updated_at: new Date().toISOString()
            }, { onConflict: 'brand_id,game_id' });

        if (error) {
            logger.error(`[GameService] Failed to toggle game ${gameId}: ${error.message}`);
            throw error;
        }

        return { success: true };
    }
}

module.exports = GameService;
