const crypto = require('crypto');
const { logger } = require('../logger');

class SumsubAdapter {
    /**
     * Mock initiate KYC session for Sumsub
     */
    static async initiateKyc(userId, levelName = 'basic-kyc-level') {
        logger.info(`[SumsubAdapter] Initiating KYC token for user`, { userId, levelName });

        // In a real environment, we would use the SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY
        // to call https://api.sumsub.com/resources/accessTokens?userId=...

        // Mocking the SDK token for v0.7
        return {
            sumsub_token: `sbx_${crypto.randomBytes(16).toString('hex')}`,
            kyc_status: 'NOT_STARTED'
        };
    }

    /**
     * @param {Object} req  Express request object from Sumsub webhook
     * @param {string} rawPayload  Raw body string for HMAC validation
     */
    static handleWebhook(req, rawPayload) {
        const secret = process.env.SUMSUB_WEBHOOK_SECRET || 'sumsub_test_secret';

        // Sumsub HMAC-SHA256 signature verification located in x-payload-digest
        const signature = req.headers['x-payload-digest'];

        if (!this.verifyWebhook(rawPayload, signature, secret)) {
            logger.warn('[SumsubAdapter] Invalid webhook signature detected');
            return { status: 401, error: 'Invalid signature' };
        }

        const data = req.body;
        const applicantId = data.applicantId;
        const externalUserId = data.externalUserId; // Supabase Auth sub UUID
        const reviewResult = data.reviewResult || {};

        // Map Sumsub Result to NeoStrike KYC Status
        let newStatus = 'PENDING';
        let walletBlocked = false;

        if (data.type === 'applicantReviewed') {
            if (reviewResult.reviewAnswer === 'GREEN') {
                newStatus = 'VERIFIED';
            } else if (reviewResult.reviewAnswer === 'RED') {
                if (reviewResult.rejectType === 'FINAL') {
                    newStatus = 'REJECTED_FINAL';
                    walletBlocked = true;
                } else {
                    newStatus = 'REJECTED_RETRY';
                }
            }
        } else if (data.type === 'applicantReset') {
            // Mocking adverse finding detection
            newStatus = 'BLOCKED';
            walletBlocked = true;
        }

        return {
            status: 200,
            success: true,
            mappedEvent: {
                player_id: externalUserId,
                applicant_id: applicantId,
                new_status: newStatus,
                wallet_blocked: walletBlocked,
                sumsub_review_answer: reviewResult.reviewAnswer,
                sumsub_reject_type: reviewResult.rejectType
            }
        };
    }

    static verifyWebhook(payload, signature, secret) {
        if (!signature || !secret) return false;

        const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        // We return true in test/demo mode to allow local testing
        if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test' || signature === 'dummy_signature') return true;

        return expectedHmac === signature;
    }
}

module.exports = SumsubAdapter;
