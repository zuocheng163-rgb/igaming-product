
const axios = require('axios');
const { logger } = require('./logger');

class RabbitMQService {
    constructor() {
        // CloudAMQP HTTP API URL structure: https://[host]/api/exchanges/[vhost]/[exchange]/publish
        // Example CLOUDAMQP_URL: amqps://user:pass@host/vhost
        this.amqpUrl = process.env.CLOUDAMQP_URL;
        this.httpUrl = this._deriveHttpUrl(this.amqpUrl);
    }

    _deriveHttpUrl(amqpUrl) {
        if (!amqpUrl) return null;
        try {
            const parsed = new URL(amqpUrl);
            const host = parsed.hostname;
            const vhost = parsed.pathname.substring(1); // Remove leading slash
            const auth = `${parsed.username}:${parsed.password}`;

            // Construct HTTP API URL for default exchange
            // Note: We use the default exchange (amq.default) or a specific one if configured
            // For simplicity, we'll publish to the default exchange with routing key = queue name
            return {
                url: `https://${host}/api/exchanges/${encodeURIComponent(vhost)}/amq.default/publish`,
                auth: {
                    username: parsed.username,
                    password: parsed.password
                }
            };
        } catch (error) {
            logger.error('[RabbitMQ] Failed to parse CLOUDAMQP_URL', error);
            return null;
        }
    }

    async publishEvent(routingKey, payload) {
        if (!this.httpUrl) {
            logger.warn('[RabbitMQ] CLOUDAMQP_URL not set. Skipping publish.');
            return false;
        }

        try {
            const body = {
                properties: {
                    content_type: "application/json",
                    delivery_mode: 2 // Persistent
                },
                routing_key: routingKey,
                payload: JSON.stringify(payload),
                payload_encoding: "string"
            };

            const response = await axios.post(this.httpUrl.url, body, {
                auth: this.httpUrl.auth,
                timeout: 5000 // 5s timeout for serverless
            });

            if (response.status === 200 && response.data.routed === true) {
                logger.info(`[RabbitMQ] Published to ${routingKey}`, { payload: payload.type });
                return true;
            } else {
                logger.warn(`[RabbitMQ] Publish accepted but not routed (Queue might not exist): ${routingKey}`);
                return true; // Still considered "sent" from our side
            }
        } catch (error) {
            logger.error('[RabbitMQ] Publish Failed', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            return false;
        }
    }
}

module.exports = new RabbitMQService();
