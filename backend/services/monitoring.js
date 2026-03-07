const supabaseService = require('./supabase');
const { logger } = require('./logger');

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
        return {
            affordability: parseFloat(config?.doc_affordability_threshold) || 1000,
            velocity: parseInt(config?.doc_velocity_spike_count) || 5,
            rapidEscalationPct: parseFloat(config?.doc_rapid_escalation_pct) || 100, // 100% = doubling
            sessionLimit: parseInt(config?.doc_session_limit_minutes) || 60
        };
    }

    /**
     * Detect "Chasing Losses" pattern
     * High risk if 5+ deposits occurred shortly after a period of net losses.
     */
    static async checkChasingLosses(userId, thresholds) {
        if (!supabaseService.client) return false;

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
        if (!supabaseService.client) return false;

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
        if (!supabaseService.client || !currentAmount) return false;

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
    static async evaluateRisk(userId, currentAmount = 0) {
        const user = await supabaseService.getUserById(userId);
        if (!user) return null;
        const publicUserId = user.user_id;

        const thresholds = await this.getThresholds(user.brand_id);

        const results = {
            isLossChasing: await this.checkChasingLosses(publicUserId, thresholds),
            isVelocitySpike: await this.checkVelocitySpike(publicUserId, thresholds),
            isRapidEscalation: await this.checkRapidEscalation(publicUserId, currentAmount, thresholds),
            isProlongedSession: await this.checkProlongedSession(publicUserId, thresholds),
            isLateNight: this.isLateNightSession(),
            isAffordabilityThresholdReached: await this.checkAffordabilityThreshold(publicUserId, thresholds)
        };

        const isRiskDetected = Object.values(results).some(v => v === true);

        if (isRiskDetected) {
            return {
                riskLevel: (results.isLossChasing || results.isAffordabilityThresholdReached || results.isRapidEscalation) ? 'HIGH' : 'MEDIUM',
                reasons: Object.entries(results).filter(([_, v]) => v === true).map(([k]) => k)
            };
        }

        return null;
    }
}

module.exports = MonitoringService;
