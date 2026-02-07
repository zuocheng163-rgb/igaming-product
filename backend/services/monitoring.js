const supabaseService = require('./supabase');
const { logger } = require('./logger');

/**
 * MonitoringService
 * Analyzes player behavior to detect risky gambling patterns.
 */
class MonitoringService {

    /**
     * Detect "Chasing Losses" pattern
     * High risk if 5+ deposits occurred shortly after a period of net losses.
     */
    static async checkChasingLosses(userId) {
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

    static async checkVelocitySpike(userId) {
        if (!supabaseService.client) return false;

        const lastMinute = new Date(Date.now() - 60 * 1000).toISOString();

        const { count, error } = await supabaseService.client
            .from('platform_audit_logs')
            .select('*', { count: 'exact', head: true })
            .eq('actor_id', userId)
            .eq('action', 'wallet:debit')
            .gte('timestamp', lastMinute);

        if (error) return false;

        if (count >= 10) {
            logger.warn(`Velocity spike detected`, { userId, betsPerMinute: count });
            return true;
        }

        return false;
    }

    static isLateNightSession() {
        const hour = new Date().getHours();
        return hour >= 2 && hour <= 6;
    }

    static async checkAffordabilityThreshold(userId) {
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

        if (totalDeposited >= 1000) {
            logger.warn(`Affordability threshold reached`, { userId, totalDeposited });
            return true;
        }

        return false;
    }

    /**
     * Main evaluate function to be called after every transaction
     */
    static async evaluateRisk(userId) {
        const results = {
            isLossChasing: await this.checkChasingLosses(userId),
            isVelocitySpike: await this.checkVelocitySpike(userId),
            isLateNight: this.isLateNightSession(),
            isAffordabilityThresholdReached: await this.checkAffordabilityThreshold(userId)
        };

        const isRiskDetected = Object.values(results).some(v => v === true);

        if (isRiskDetected) {
            return {
                riskLevel: (results.isLossChasing || results.isAffordabilityThresholdReached) ? 'HIGH' : 'MEDIUM',
                reasons: Object.entries(results).filter(([_, v]) => v === true).map(([k]) => k)
            };
        }

        return null;
    }
}

module.exports = MonitoringService;
