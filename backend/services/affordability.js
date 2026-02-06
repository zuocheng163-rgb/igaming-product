const { logger } = require('./logger');

/**
 * AffordabilityService
 * Handles automated player affordability verification (Plaid Integration Mock).
 */
class AffordabilityService {
    /**
     * Generate a Plaid Link Token for the frontend
     * @param {string} userId
     */
    static async getLinkToken(userId) {
        logger.info(`Generating Affordability Link Token`, { userId });
        // In production, we'd call Plaid API: client.linkTokenCreate(...)
        return `link-sandbox-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Exchange public token and perform initial verification
     */
    static async verifyAffordability(userId, publicToken) {
        logger.info(`Verifying Affordability for user`, { userId });

        // Mock Plaid Asset Report logic
        // If publicToken contains 'fail', we'll mark as low liquidity
        const isVerified = !publicToken.includes('fail');

        return {
            status: isVerified ? 'VERIFIED' : 'FAILED',
            last_checked: new Date().toISOString(),
            monthly_income_est: isVerified ? 5000 : 800,
            risk_score: isVerified ? 'LOW' : 'HIGH'
        };
    }
}

module.exports = AffordabilityService;
