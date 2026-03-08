'use strict';
/**
 * RGScoreService
 * Calculates and persists the composite Responsible Gambling risk score.
 *
 * Score breakdown (max 12 points):
 *   net_loss_tier          0-3   (tier1=1, tier2=2, tier3=3)
 *   return_pattern         0-3   (3+ rapid returns within window = 3, 2=2, 1=1)
 *   baseline_deviation     0-2   (50%+ above 90-day median = 2, 25%+=1)
 *   chasing_consecutive    0-2   (≥ threshold consecutive deposits post-loss = 2, half=1)
 *   late_night_activity    0-1
 *   prolonged_session      0-1
 *
 * Soft suppression  (bonus block + welfare flag): score >= rg_soft_suppress_score
 * Hard suppression  (bonus block + EDD trigger):  score >= rg_hard_suppress_score
 */

const supabaseService = require('./supabase');
const { logger } = require('./logger');
const RGAuditService = require('./rg-audit-service');

// Monitoring only kicks in after this many days since registration
const MONITORING_GRACE_DAYS = 56;

class RGScoreService {
    // -------------------------------------------------------------------------
    // Config helpers
    // -------------------------------------------------------------------------
    static async _getConfig(tenantId) {
        // tenant_configs uses brand_id (int), tenantId may be UUID or int — supabaseService handles mapping
        const cfg = await supabaseService.getTenantConfig(tenantId) || {};
        return {
            returnWindowMinutes: cfg.rg_return_window_minutes    ?? 60,
            returnPatternCount:  cfg.rg_return_pattern_count     ?? 3,
            chasingCount:        cfg.rg_chasing_consecutive_deposits ?? 5,
            netTier1:            parseFloat(cfg.rg_net_tier1     ?? 500),
            netTier2:            parseFloat(cfg.rg_net_tier2     ?? 2000),
            netTier3:            parseFloat(cfg.rg_net_tier3     ?? 5000),
            softScore:           cfg.rg_soft_suppress_score      ?? 6,
            hardScore:           cfg.rg_hard_suppress_score      ?? 9,
        };
    }

    // -------------------------------------------------------------------------
    // Sub-scorers (each returns { score, detail })
    // -------------------------------------------------------------------------

    static async _scoreNetLoss(playerId, tenantId, cfg) {
        // Sum net position over rolling 30 days (negative = player profit, positive = player loss)
        const since = new Date(Date.now() - 30 * 86400_000).toISOString();
        const { data, error } = await supabaseService.client
            .from('payment_transactions')
            .select('event_type, net_amount')
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId)
            .gte('created_at', since)
            .in('status', ['CONFIRMED']);

        if (error || !data) return { score: 0, detail: { netLoss: 0, tier: 'none' } };

        let netLoss = 0;
        for (const tx of data) {
            if (tx.event_type === 'DEPOSIT')    netLoss += parseFloat(tx.net_amount || 0);
            if (tx.event_type === 'WITHDRAWAL') netLoss -= parseFloat(tx.net_amount || 0);
        }

        let score = 0;
        let tier = 'none';
        if (netLoss >= cfg.netTier3) { score = 3; tier = 'tier3'; }
        else if (netLoss >= cfg.netTier2) { score = 2; tier = 'tier2'; }
        else if (netLoss >= cfg.netTier1) { score = 1; tier = 'tier1'; }

        return { score, detail: { netLoss, tier } };
    }

    static async _scoreReturnPattern(playerId, tenantId, cfg) {
        // Count rapid-return events in last 30 days
        const since = new Date(Date.now() - 30 * 86400_000).toISOString();
        const { data, error } = await supabaseService.client
            .from('rg_return_events')
            .select('minutes_gap')
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId)
            .gte('session_ended_at', since)
            .lte('minutes_gap', cfg.returnWindowMinutes)
            .not('minutes_gap', 'is', null);

        if (error || !data) return { score: 0, detail: { rapidReturns: 0 } };

        const count = data.length;
        let score = 0;
        if (count >= cfg.returnPatternCount) score = 3;
        else if (count === 2)                score = 2;
        else if (count === 1)                score = 1;

        return { score, detail: { rapidReturns: count } };
    }

    static async _scoreBaselineDeviation(playerId, tenantId, cfg) {
        const { data: metrics } = await supabaseService.client
            .from('rg_player_metrics')
            .select('baseline_deposit_median')
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (!metrics?.baseline_deposit_median) return { score: 0, detail: {} };

        const median = parseFloat(metrics.baseline_deposit_median);
        const since = new Date(Date.now() - 7 * 86400_000).toISOString();

        const { data: recent } = await supabaseService.client
            .from('payment_transactions')
            .select('net_amount')
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId)
            .eq('event_type', 'DEPOSIT')
            .gte('created_at', since)
            .in('status', ['CONFIRMED']);

        if (!recent || recent.length === 0) return { score: 0, detail: {} };

        const weeklyTotal = recent.reduce((s, r) => s + parseFloat(r.net_amount || 0), 0);
        // Compare weekly total vs median weekly (median is per deposit so multiply by rough weekly freq)
        const deviation = median > 0 ? (weeklyTotal - median) / median : 0;

        let score = 0;
        if (deviation >= 0.5) score = 2;
        else if (deviation >= 0.25) score = 1;

        return { score, detail: { deviation: +(deviation * 100).toFixed(1) } };
    }

    static async _scoreChasingLosses(playerId, tenantId, cfg) {
        // Count consecutive deposits after a loss-making session, in last 24 h
        const since = new Date(Date.now() - 86400_000).toISOString();
        const { data, error } = await supabaseService.client
            .from('platform_audit_logs')
            .select('action, timestamp')
            .eq('actor_id', playerId)
            .in('action', ['wallet:deposit', 'game:round_end'])
            .gte('timestamp', since)
            .order('timestamp', { ascending: true });

        if (error || !data) return { score: 0, detail: {} };

        let consecutiveDepositsAfterLoss = 0;
        let inLossMode = false;
        for (const row of data) {
            if (row.action === 'game:round_end') { inLossMode = true; }
            else if (row.action === 'wallet:deposit' && inLossMode) { consecutiveDepositsAfterLoss++; }
            else { inLossMode = false; consecutiveDepositsAfterLoss = 0; }
        }

        let score = 0;
        if (consecutiveDepositsAfterLoss >= cfg.chasingCount)                   score = 2;
        else if (consecutiveDepositsAfterLoss >= Math.ceil(cfg.chasingCount / 2)) score = 1;

        return { score, detail: { consecutiveDepositsAfterLoss } };
    }

    // -------------------------------------------------------------------------
    // Main calculation
    // -------------------------------------------------------------------------

    /**
     * Recalculate the composite score for a player and persist to rg_player_metrics.
     * Returns the full score object.
     */
    static async recalculate(playerId, tenantId) {
        if (!supabaseService.client) return null;

        // Advanced Tier Check
        const cfg = await supabaseService.getTenantConfig(tenantId);
        if (cfg?.product_tier !== 'advanced') {
            logger.debug(`[RGScore] Skipping recalculate for player ${playerId} — Brand ${tenantId} is on Basic tier`);
            return null;
        }

        // Check if player is old enough to be monitored
        const { data: profile } = await supabaseService.client
            .from('player_profiles')
            .select('registered_at')
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId)
            .maybeSingle();

        const rgDay = profile?.registered_at
            ? Math.floor((Date.now() - new Date(profile.registered_at)) / 86400_000)
            : 0;

        const monitoringActive = rgDay >= MONITORING_GRACE_DAYS;

        // Use the tenant config already fetched for the tier check
        const scoringCfg = {
            returnWindowMinutes: cfg.rg_return_window_minutes    ?? 60,
            returnPatternCount:  cfg.rg_return_pattern_count     ?? 3,
            chasingCount:        cfg.rg_chasing_consecutive_deposits ?? 5,
            netTier1:            parseFloat(cfg.rg_net_tier1     ?? 500),
            netTier2:            parseFloat(cfg.rg_net_tier2     ?? 2000),
            netTier3:            parseFloat(cfg.rg_net_tier3     ?? 5000),
            softScore:           cfg.rg_soft_suppress_score      ?? 6,
            hardScore:           cfg.rg_hard_suppress_score      ?? 9,
        };
        const hour = new Date().getHours();

        const [netResult, returnResult, deviationResult, chasingResult] = await Promise.all([
            this._scoreNetLoss(playerId, tenantId, scoringCfg),
            this._scoreReturnPattern(playerId, tenantId, scoringCfg),
            this._scoreBaselineDeviation(playerId, tenantId, scoringCfg),
            this._scoreChasingLosses(playerId, tenantId, scoringCfg),
        ]);

        const lateNight    = (hour >= 2 && hour < 6) ? 1 : 0;
        // Prolonged session: derived from return events — if session_ended_at was null for >180 min
        const prolonged    = 0; // placeholder — real check in monitoring.js

        const breakdown = {
            net_loss_tier:      netResult.score,
            return_pattern:     returnResult.score,
            baseline_deviation: deviationResult.score,
            chasing_losses:     chasingResult.score,
            late_night:         lateNight,
            prolonged_session:  prolonged,
        };

        const compositeScore = Object.values(breakdown).reduce((s, v) => s + v, 0);
        const netTier = netResult.detail.tier || 'none';

        const { error } = await supabaseService.client
            .from('rg_player_metrics')
            .upsert({
                player_id:            playerId,
                tenant_id:            tenantId,
                composite_score:      compositeScore,
                score_breakdown:      breakdown,
                monitoring_active:    monitoringActive,
                net_loss_tier:        netTier,
                last_score_updated_at: new Date().toISOString(),
            }, { onConflict: 'player_id,tenant_id' });

        if (error) {
            logger.error('[RGScore] Failed to upsert player metrics', { error: error.message, playerId });
        }

        // Emit audit events for threshold crossings
        if (monitoringActive && compositeScore >= cfg.hardScore) {
            await RGAuditService.log(tenantId, playerId, 'RG_EDD_PENDING_SET', { compositeScore, breakdown });
        } else if (monitoringActive && compositeScore >= cfg.softScore) {
            await RGAuditService.log(tenantId, playerId, 'RG_HARM_SIGNAL_DETECTED', { compositeScore, breakdown });
        }

        logger.info('[RGScore] Score calculated', { playerId, compositeScore, monitoringActive });

        return {
            compositeScore,
            breakdown,
            monitoringActive,
            netTier,
            softSuppressed: monitoringActive && compositeScore >= cfg.softScore,
            hardSuppressed: monitoringActive && compositeScore >= cfg.hardScore,
        };
    }

    /**
     * Fast read of the current stored score (no recalculation).
     */
    static async getScore(playerId, tenantId) {
        if (!supabaseService.client) return null;

        const { data, error } = await supabaseService.client
            .from('rg_player_metrics')
            .select('*')
            .eq('player_id', playerId)
            .eq('tenant_id', tenantId)
            .maybeSingle();

        if (error) { logger.error('[RGScore] getScore error', { error: error.message }); return null; }
        return data;
    }
}

module.exports = RGScoreService;
