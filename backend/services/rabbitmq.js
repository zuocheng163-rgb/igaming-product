const amqp = require('amqplib');
const { logger } = require('./logger');

class RabbitMQService {
    constructor() {
        this.amqpUrl = process.env.CLOUDAMQP_URL;
        this.defaultQueue = process.env.RABBITMQ_QUEUE || 'fasttrack-events';
    }

    /**
     * Publishes an event to RabbitMQ using the AMQP protocol.
     * This ensures the message is "further processed by Rabbit" (headers, properties, etc.)
     * and avoids the wrapping mess caused by the HTTP Management API.
     */
    async publishEvent(routingKey, payload, type = null, options = {}) {
        if (!this.amqpUrl) {
            logger.warn('[RabbitMQ] CLOUDAMQP_URL not set. Asynchronous event publishing is disabled.');
            return false;
        }

        const targetRoutingKey = routingKey || this.defaultQueue;
        let connection = null;

        try {
            // Establish a new connection for serverless (Vercel)
            // In a long-running environment, we would use a persistent connection.
            connection = await amqp.connect(this.amqpUrl);
            const channel = await connection.createChannel();

            // Ensure the queue exists
            await channel.assertQueue(targetRoutingKey, {
                durable: true
            });

            const content = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));

            const properties = {
                contentType: 'application/json',
                deliveryMode: 2, // Persistent
                type: type || (payload && payload.type) || '',
                headers: options.headers || {}
            };

            const published = channel.sendToQueue(targetRoutingKey, content, properties);

            if (published) {
                logger.debug(`[RabbitMQ] Published to ${targetRoutingKey}`, { type: properties.type });
            }

            // Close gracefully
            await channel.close();
            await connection.close();

            return true;
        } catch (error) {
            logger.error('[RabbitMQ] amqplib Publish Failed', {
                message: error.message,
                stack: error.stack
            });

            // Clean up connection if it was opened
            if (connection) {
                try { await connection.close(); } catch (e) { }
            }

            return false;
        }
    }
}

module.exports = new RabbitMQService();
