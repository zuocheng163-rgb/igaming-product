
const axios = require('axios');
const { logger } = require('./logger');

class RabbitMQService {
    constructor() {
        // CloudAMQP HTTP API URL structure: https://[host]/api/exchanges/[vhost]/[exchange]/publish
        // Example CLOUDAMQP_URL: amqps://user:pass@host/vhost
        this.amqpUrl = process.env.CLOUDAMQP_URL;
        this.defaultQueue = process.env.RABBITMQ_QUEUE || 'fasttrack-events';
        this.httpUrl = this._deriveHttpUrl(this.amqpUrl);
    }

    _deriveHttpUrl(amqpUrl) {
        if (!amqpUrl) return null;
        try {
            const parsed = new URL(amqpUrl);
            const host = parsed.hostname;
            // Handle default vhost: In CloudAMQP/RabbitMQ HTTP API, '/' vhost must be encoded as '%2f'
            let vhost = parsed.pathname.substring(1);
            if (!vhost || vhost === '/') vhost = '%2f';
            else vhost = encodeURIComponent(vhost);

            const auth = {
                username: parsed.username,
                password: parsed.password
            };

            logger.info(`[RabbitMQ] Initializing Service`, {
                host,
                vhost: vhost === '%2f' ? '/' : vhost,
                user: parsed.username
            });

            return {
                url: `https://${host}/api/exchanges/${vhost}/amq.default/publish`,
                auth
            };
        } catch (error) {
            logger.error('[RabbitMQ] Failed to parse CLOUDAMQP_URL', error);
            return null;
        }
    }

    async publishEvent(routingKey, payload, type = null) {
        if (!this.httpUrl) {
            logger.warn('[RabbitMQ] CLOUDAMQP_URL not set or invalid. Asynchronous event publishing is disabled.');
            return false;
        }

        const targetRoutingKey = routingKey || this.defaultQueue;

        try {
            const body = {
                properties: {
                    content_type: "application/json",
                    delivery_mode: 2, // Persistent
                    type: type || (payload && payload.type) || "" // Set AMQP type property
                },
                routing_key: targetRoutingKey,
                payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
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
