const axios = require('axios');
const { logger } = require('./logger');

/**
 * SlackService
 * Handles sending notifications to Slack via Webhooks.
 */
class SlackService {
    /**
     * Send a notification to Slack
     * @param {string} message - The text message to send
     * @param {object} blocks - Optional Slack Block Kit blocks for rich formatting
     */
    static async notify(message, blocks = null) {
        const webhookUrl = process.env.SLACK_WEBHOOK_URL;

        if (!webhookUrl) {
            logger.debug('Slack notification skipped: SLACK_WEBHOOK_URL not set');
            return;
        }

        try {
            const payload = {
                text: message,
                ...(blocks && { blocks })
            };

            await axios.post(webhookUrl, payload);
            logger.info('Slack notification sent successfully');
        } catch (error) {
            logger.error('Failed to send Slack notification', { error: error.message });
        }
    }

    /**
     * Send a rich risk alert for AI Duty of Care
     */
    static async sendRiskAlert(userId, riskData) {
        const message = `🚨 *High Risk Behavior Detected* for User: ${userId}`;
        const blocks = [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*🚨 High Risk Behavior Detected*\n*User ID:* ${userId}\n*Risk Level:* ${riskData.riskLevel}\n*Reasons:* ${riskData.reasons.join(', ')}`
                }
            },
            {
                type: "actions",
                elements: [
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "View Player Details"
                        },
                        url: `${process.env.PORTAL_URL || 'http://localhost:5173'}/portal/players`
                    }
                ]
            }
        ];

        await this.notify(message, blocks);
    }
}

module.exports = SlackService;
