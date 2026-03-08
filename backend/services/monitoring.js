const supabaseService = require('./supabase');
const { logger } = require('./logger');
const RGScoreService = require('./rg-score-service');

/**
 * MonitoringService
 * Analyzes player behavior to detect risky gambling patterns.
 */
class MonitoringService {
    /**
     * Helper to get thresholds for a player
     */
    static async getThresholds(brandId) {
        const config = await supabaseService.getTenantConfig(brandId || 1);

        if (!config) {
            logger.warn(`[Monitoring] No tenant config found for Brand ${brandId}, using hardcoded defaults`, { brandId });
        } else {
            logger.debug(`[Monitoring] Applied DoC thresholds for Brand ${brandId}`, {
                tier: config.product_tier,
                velocity: config.doc_velocity_spike_count,
                affordability: config.doc_affordability_threshold,
                limit: config.doc_session_limit_minutes
            });
        }

        // Return values from DB, or fallback to sensible defaults if null/missing
        return {
            tier: config?.product_tier || 'basic',
            affordability: parseFloat(config?.doc_affordability_threshold ?? 1000),
            velocity: parseInt(config?.doc_velocity_spike_count ?? 5),
            rapidEscalationPct: parseFloat(config?.doc_rapid_escalation_pct ?? 100),
            sessionLimit: parseInt(config?.doc_session_limit_minutes ?? 60)
        };
    }

    /**
     * Detect "Chasing Losses" pattern
     * High risk if 5+ deposits occurred shortly after a period of net losses.
     */
    static async checkChasingLosses(userId, thresholds) {
        if (!supabaseService.client || thresholds.tier !== 'advanced') return false;

        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: txs, error } = await supabaseService.client
            .from('platform_audit_logs')
            .select('*')
            .eq('actor_id', userId)
            .gte('timestamp', yesterday)
            .order('timestamp', { ascending: false });

        if (error || !txs) return false;

        const deposits = txs.filter(t => t.action === 'wallet:deposit');

        if (deposits.length >= 5) {
            logger.warn(`Potential loss chasing detected`, { userId, depositCount: deposits.length });
            return true;
        }

        return false;
    }

    static async checkVelocitySpike(userId, thresholds) {
        if (!supabaseService.client || thresholds.tier !== 'advanced') return false;

        const lastMinute = new Date(Date.now() - 60 * 1000).toISOString();

        const { count, error } = await supabaseService.client
            .from('platform_audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('actor_id', userId)
            .eq('action', 'wallet:debit')
            .gte('timestamp', lastMinute);

        if (error) {
            logger.error(`[Monitoring] Velocity check error`, { error: error.message, userId });
            return false;
        }

        if (count >= thresholds.velocity) {
            logger.warn(`Velocity spike detected`, { userId, betsPerMinute: count, threshold: thresholds.velocity });
            return true;
        }

        return false;
    }

    /**
     * Detect "Rapid Escalation"
     * Trigger if the current bet is > X% higher than the average of the last 10 bets.
     */
    static async checkRapidEscalation(userId, currentAmount, thresholds) {
        if (!supabaseService.client || !currentAmount || thresholds.tier !== 'advanced') return false;

        const { data: recentBets, error } = await supabaseService.client
            .from('platform_audit_logs')
            .select('metadata')
            .eq('actor_id', userId)
            .eq('action', 'wallet:debit')
            .order('timestamp', { ascending: false })
            .limit(10);

        if (error || !recentBets || recentBets.length < 3) return false;

        const sum = recentBets.reduce((acc, b) => acc + (parseFloat(b.metadata?.request?.amount) || 0), 0);
        const avg = sum / recentBets.length;

        const increasePct = ((currentAmount - avg) / avg) * 100;

        if (increasePct >= thresholds.rapidEscalationPct) {
            logger.warn(`Rapid escalation detected`, { userId, currentAmount, avg, increasePct, threshold: thresholds.rapidEscalationPct });
            return true;
        }

        return false;
    }

    /**
     * Detect "Prolonged Session"
     * Trigger if the user has been active for more than X minutes.
     */
    static async checkProlongedSession(userId, thresholds) {
        if (!supabaseService.client) return false;

        // Find the first activity in the last 12 hours
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const { data: activities, error } = await supabaseService.client
            .from('platform_audit_logs')
            .select('timestamp')
            .eq('actor_id', userId)
            .gte('timestamp', twelveHoursAgo)
            .order('timestamp', { ascending: true })
            .limit(1);

        if (error || !activities || activities.length === 0) return false;

        const startTime = new Date(activities[0].timestamp).getTime();
        const durationMinutes = (Date.now() - startTime) / (1000 * 60);

        if (durationMinutes >= thresholds.sessionLimit) {
            logger.warn(`Prolonged session detected`, { userId, durationMinutes, threshold: thresholds.sessionLimit });
            return true;
        }

        return false;
    }

    static isLateNightSession() {
        const hour = new Date().getHours();
        return hour >= 2 && hour <= 6;
    }

    static async checkDepositVelocity(userId, thresholds) {
        if (!supabaseService.client || thresholds.tier !== 'advanced') return false;

        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { count, error } = await supabaseService.client
            .from('platform_audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('actor_id', userId)
            .eq('action', 'wallet:deposit')
            .gte('timestamp', fifteenMinsAgo);

        if (error) return false;

        // Threshold: 3 deposits in 15 mins
        if (count >= 3) {
            logger.warn(`Deposit velocity spike detected`, { userId, count });
            return true;
        }
        return false;
    }

    static async checkAffordabilityThreshold(userId, thresholds) {
        if (!supabaseService.client) return false;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: deposits, error } = await supabaseService.client
            .from('platform_audit_logs')
            .select('metadata')
            .eq('actor_id', userId)
            .eq('action', 'wallet:deposit')
            .gte('timestamp', thirtyDaysAgo);

        if (error || !deposits) return false;

        const totalDeposited = deposits.reduce((sum, d) => sum + (parseFloat(d.metadata?.amount) || 0), 0);

        if (totalDeposited >= thresholds.affordability) {
            logger.warn(`Affordability threshold reached`, { userId, totalDeposited, threshold: thresholds.affordability });
            return true;
        }

        return false;
    }

    /**
     * Main evaluate function to be called after every transaction
     */
    static async evaluateRisk(userId, currentAmount = 0, explicitBrandId = null) {
        const user = await supabaseService.getUserById(userId);
        if (!user) return null;
        const publicUserId = user.user_id;

        // Use explicit brandId from caller (WalletService) if provided, 
        // fallback to user's brand_id, then finally default to 1.
        const brandId = explicitBrandId || user.brand_id || 1;
        const thresholds = await this.getThresholds(brandId);

        const results = {
            isLossChasing: await this.checkChasingLosses(publicUserId, thresholds),
            isVelocitySpike: await this.checkVelocitySpike(publicUserId, thresholds),
            isDepositVelocitySpike: await this.checkDepositVelocity(publicUserId, thresholds),
            isRapidEscalation: await this.checkRapidEscalation(publicUserId, currentAmount, thresholds),
            isProlongedSession: await this.checkProlongedSession(publicUserId, thresholds),
            isLateNight: this.isLateNightSession(),
            isAffordabilityThresholdReached: await this.checkAffordabilityThreshold(publicUserId, thresholds)
        };

        let scoreData = null;
        if (thresholds.tier === 'advanced') {
            scoreData = await RGScoreService.recalculate(user.id, brandId);
        }

        const isRiskDetected = Object.values(results).some(v => v === true) || (scoreData && scoreData.compositeScore >= 6);

        if (isRiskDetected) {
            return {
                riskLevel: (results.isLossChasing || results.isAffordabilityThresholdReached || results.isRapidEscalation || (scoreData && scoreData.compositeScore >= 9)) ? 'HIGH' : 'MEDIUM',
                reasons: Object.entries(results).filter(([_, v]) => v === true).map(([k]) => k),
                compositeScore: scoreData?.compositeScore,
                netLossTier: scoreData?.netTier
            };
        }

        return null;
    }
}

module.exports = MonitoringService;
