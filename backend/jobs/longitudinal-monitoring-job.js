'use strict';
/**
 * Longitudinal Monitoring Job
 * Designed to run daily (e.g., 02:00 UTC).
 * 
 * Responsibilities:
 * 1. Calculate 90-day deposit baselines (median amount/freq).
 * 2. Evaluate 30/90-day net positions.
 * 3. Update rg_player_metrics.
 * 4. Trigger risk score recalculation for monitored players.
 */

const supabaseService = require('../services/supabase');
const RGScoreService = require('../services/rg-score-service');
const { logger } = require('../services/logger');

const MONITORING_GRACE_DAYS = 56;

// brand_id -> tenant_id UUID mapping
const getTenantUuid = (brandId) => {
    if (brandId === 1 || brandId === '1') return '37562b54-0c91-491c-b996-2efb68e7baf3';
    return null;
};

async function runLongitudinalMonitoring() {
    logger.info('[Job] Starting Daily Longitudinal Monitoring');
    
    if (!supabaseService.client) {
        logger.error('[Job] Supabase client not initialized');
        return;
    }

    // 1. Get all Advanced Tier tenants
    const { data: tenants, error: tenantError } = await supabaseService.client
        .from('tenant_configs')
        .select('brand_id, product_tier')
        .eq('product_tier', 'advanced');

    if (tenantError) {
        logger.error('[Job] Failed to fetch tenants', { error: tenantError });
        return;
    }

    for (const tenant of tenants) {
        const brandId = tenant.brand_id;
        const tenantUuid = getTenantUuid(brandId);
        if (!tenantUuid) {
            logger.warn(`[Job] No UUID mapping for brand_id ${brandId}, skipping.`);
            continue;
        }

        logger.info(`[Job] Processing Brand: ${brandId} (UUID: ${tenantUuid})`);

        // 2. Get players (Simplified for PoC: only those with activity in last 90 days)
        const ninetyDaysAgo = new Date(Date.now() - 90 * 86400 * 1000).toISOString();
        
        const { data: players, error: playerError } = await supabaseService.client
            .from('player_profiles')
            .select('id, player_id, created_at')
            .eq('brand_id', brandId);

        if (playerError || !players) {
            logger.error(`[Job] Failed to fetch players for brand ${brandId}`, { error: playerError });
            continue;
        }

        for (const player of players) {
            try {
                // 3. Baseline Calculation: 90-day median deposit amount
                const { data: deposits, error: depError } = await supabaseService.client
                    .from('payment_transactions')
                    .select('net_amount')
                    .eq('player_id', player.id)
                    .eq('event_type', 'DEPOSIT')
                    .eq('status', 'CONFIRMED')
                    .gte('created_at', ninetyDaysAgo);

                if (depError) throw depError;

                let median = null;
                if (deposits && deposits.length > 0) {
                    const amounts = deposits.map(d => parseFloat(d.net_amount)).sort((a,b) => a - b);
                    const mid = Math.floor(amounts.length / 2);
                    median = amounts.length % 2 !== 0 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;
                }

                const accountAgeDays = Math.floor((new Date() - new Date(player.created_at)) / (86400 * 1000));
                const monitoringActive = accountAgeDays >= MONITORING_GRACE_DAYS;

                // 4. Update Metrics Table
                await supabaseService.client
                    .from('rg_player_metrics')
                    .upsert({
                        player_id: player.id,
                        tenant_id: tenantUuid,
                        baseline_deposit_median: median,
                        monitoring_active: monitoringActive,
                        last_score_updated_at: new Date().toISOString()
                    }, { onConflict: 'player_id, tenant_id' });

                // 5. Trigger Full Score Recalculation
                if (monitoringActive) {
                    await RGScoreService.recalculate(player.id, brandId);
                }

            } catch (err) {
                logger.error(`[Job] Error processing player ${player.id}`, { error: err.message });
            }
        }
    }

    logger.info('[Job] Daily Longitudinal Monitoring Complete');
}

// Support direct execution via CLI
if (require.main === module) {
    runLongitudinalMonitoring().then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { runLongitudinalMonitoring };
