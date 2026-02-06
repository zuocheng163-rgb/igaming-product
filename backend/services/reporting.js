const supabaseService = require('./supabase');
const { logger } = require('./logger');

/**
 * ReportingService
 * Handles business intelligence and performance metrics aggregation.
 */
class ReportingService {

    /**
     * Get high-level summary for an operator dashboard
     */
    static async getOperatorSummary(operatorId) {
        logger.info(`Generating report summary for operator: ${operatorId}`);

        try {
            const kpis = await supabaseService.getAggregatedKPIs(operatorId);
            const transactions = await supabaseService.getTransactionsByOperator(operatorId);

            // Calculate active users (mocked from transactions)
            const activeUsers = new Set(transactions.map(tx => tx.actor_id)).size;

            return {
                ...kpis,
                active_users: activeUsers,
                timeframe: 'LAST_30_DAYS',
                currency: 'EUR'
            };
        } catch (error) {
            logger.error(`Failed to generate report for ${operatorId}`, { error: error.message });
            throw error;
        }
    }

    /**
     * Churn Prediction Heuristic
     * If a user hasn't had a transaction in 7 days, they are "at risk"
     */
    static async getChurnRiskProfiles(operatorId) {
        const transactions = await supabaseService.getTransactionsByOperator(operatorId);
        const now = new Date();
        const churnThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

        const userLastActivity = {};
        transactions.forEach(tx => {
            const txTime = new Date(tx.timestamp);
            if (!userLastActivity[tx.actor_id] || txTime > userLastActivity[tx.actor_id]) {
                userLastActivity[tx.actor_id] = txTime;
            }
        });

        const profiles = Object.entries(userLastActivity).map(([userId, lastTime]) => {
            const inactiveMs = now - lastTime;
            return {
                userId,
                lastSeen: lastTime.toISOString(),
                risk: inactiveMs > churnThreshold ? 'HIGH' : 'LOW'
            };
        });

        return profiles.filter(p => p.risk === 'HIGH');
    }

    /**
     * Get real-time stats (Big Wins, Spikes)
     */
    static async getLiveMetrics(operatorId) {
        const transactions = await supabaseService.getTransactionsByOperator(operatorId);
        const lastHour = new Date(Date.now() - 60 * 60 * 1000);

        const recentTxs = transactions.filter(tx => new Date(tx.timestamp) > lastHour);
        const bigWins = recentTxs.filter(tx => tx.action === 'wallet:credit' && (tx.metadata?.request?.amount || 0) > 1000);

        return {
            recent_transaction_volume: recentTxs.length,
            big_wins_detected: bigWins.length,
            large_wins: bigWins.map(w => ({ userId: w.actor_id, amount: w.metadata?.request?.amount })),
            anomalies: this.detectAnomalies(recentTxs)
        };
    }

    /**
     * Simple Anomaly Detection
     */
    static detectAnomalies(transactions) {
        const anomalies = [];

        // 1. Success Rate Volatility
        const total = transactions.length;
        if (total > 50) {
            const successCount = transactions.filter(tx => tx.status === 'success').length;
            const rate = successCount / total;
            if (rate < 0.5) anomalies.push({ type: 'LOW_SUCCESS_RATE', value: rate, severity: 'HIGH' });
        }

        // 2. High Velocity User
        const userCounts = {};
        transactions.forEach(tx => {
            userCounts[tx.actor_id] = (userCounts[tx.actor_id] || 0) + 1;
        });

        Object.entries(userCounts).forEach(([userId, count]) => {
            if (count > 20) anomalies.push({ type: 'SPAM_SUSPICION', userId, count, severity: 'MEDIUM' });
        });

        return anomalies;
    }
}

module.exports = ReportingService;
