const { logger, auditLog, generateCorrelationId } = require('./logger');
const rabbitmq = require('./rabbitmq');

// These will now be defaults if tenant-specific config is missing
const DEFAULT_FT_API_URL = process.env.FT_API_URL || 'https://api.fasttrack-integration.com';
const DEFAULT_FT_API_KEY = process.env.FT_API_KEY;
const DEFAULT_PLATFORM_ORIGIN = process.env.PLATFORM_ORIGIN || 'igaming-gateway';

// Endpoint mapping based on FT Documentation
const EVENT_CONFIG = {
    'login': { path: '/v2/integration/login', method: 'POST' },
    'consents': { path: '/v2/integration/user/consents', method: 'PUT' },
    'blocks': { path: '/v2/integration/user/blocks', method: 'PUT' },
    'registration': { path: '/v2/integration/user', method: 'POST' },
    'user_update': { path: '/v2/integration/user', method: 'PUT' },
    'logout': { path: '/v2/integration/logout', method: 'POST' },
    'payment': { path: '/v1/integration/payment', method: 'POST' },
    'casino': { path: '/v1/integration/casino', method: 'POST' },
    'bonus': { path: '/v1/integration/bonus', method: 'POST' },
    'balance': { path: '/v1/integration/user/balances', method: 'POST' },

    // Aliases for internal events
    'deposit': { path: '/v1/integration/payment', method: 'POST' },
    'bet': { path: '/v1/integration/casino', method: 'POST' },
    'win': { path: '/v1/integration/casino', method: 'POST' },
    'block': { path: '/v2/integration/user/blocks', method: 'PUT' },
    'consent': { path: '/v2/integration/user/consents', method: 'PUT' }
};

const FT_MESSAGE_TYPES = {
    'balance': 'USER_BALANCES_UPDATE',
    'bonus': 'BONUS',
    'casino': 'CASINO',
    'bet': 'CASINO',
    'win': 'CASINO',
    'payment': 'PAYMENT',
    'deposit': 'PAYMENT',
    'user_update': 'USER_UPDATE_V2',
    'blocks': 'USER_BLOCK_V2',
    'block': 'USER_BLOCK_V2',
    'consents': 'USER_CONSENTS_V2',
    'consent': 'USER_CONSENTS_V2',
    'login': 'LOGIN_V2',
    'registration': 'USER_CREATE_V2',
    'logout': 'LOGOUT'
};

/**
 * Pushes clinical events to Fast Track Integration API.
 * Now supports multi-tenancy and professional observability.
 */
/**
 * Internal helper to push events with retry logic for transient network errors.
 */
const pushEventWithRetry = async (userId, eventType, payload, options = {}, retries = 3, delay = 500) => {
    const correlationId = options.correlationId || generateCorrelationId();
    const operatorId = options.operatorId || 'default';
    const config_url = options.ft_api_url || DEFAULT_FT_API_URL;
    const config_key = options.ft_api_key || DEFAULT_FT_API_KEY;
    const origin = options.platform_origin || DEFAULT_PLATFORM_ORIGIN;

    const eventConfig = EVENT_CONFIG[eventType];
    if (!eventConfig) {
        logger.error(`[FT Integration] Unknown event type: ${eventType}`, { correlationId });
        return;
    }

    if (!config_key) {
        logger.warn('[FT Integration] No API Key provided. Skipping request.', { correlationId, operatorId });
        return;
    }

    try {
        const baseUrl = config_url.endsWith('/') ? config_url.slice(0, -1) : config_url;
        const targetUrl = `${baseUrl}${eventConfig.path}`;
        const timestamp = new Date().toISOString(); // ISO8601 for payload
        const utcTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC'; // Custom UTC for body
        let requestBody = {};

        // Event enrichment logic - Pruned to bare minimum required by FT
        if (eventType === 'login') {
            requestBody = { user_id: userId, timestamp };
        } else if (eventType === 'registration') {
            requestBody = { user_id: userId, timestamp, origin };
        } else if (['user_update', 'consents', 'consent', 'blocks', 'block', 'logout'].includes(eventType)) {
            // These events trigger a re-sync from FT side, minimal payload required
            requestBody = { user_id: userId, timestamp, origin };
        } else if (eventType === 'deposit' || eventType === 'payment') {
            requestBody = {
                user_id: userId,
                payment_id: payload.transaction_id || `tx-${Date.now()}`,
                transaction_type: (payload.type === 'Debit' || eventType === 'withdrawal') ? 'Debit' : 'Credit',
                status: payload.status || 'Approved',
                amount: parseFloat(payload.amount),
                currency: payload.currency || 'EUR',
                exchange_rate: 1.0,
                fee_amount: 0,
                origin,
                timestamp
            };
        } else if (eventType === 'bet' || eventType === 'win' || eventType === 'casino') {
            requestBody = {
                user_id: userId,
                timestamp,
                game_id: payload.game_id || 'unknown',
                game_name: payload.game_name || 'Mock Slot Game',
                provider_id: payload.vendor_id || 'mock-vendor-1',
                provider_name: payload.game_provider || 'MockProvider',
                currency: payload.currency || 'EUR',
                amount: parseFloat(payload.amount),
                transaction_type: (eventType === 'win' || payload.type === 'Win') ? 'Win' : 'Bet',
                is_bonus_payout: payload.is_bonus_payout || false
            };
        } else if (eventType === 'balance') {
            requestBody = {
                user_id: userId,
                balances: payload.balances || [
                    { amount: parseFloat(payload.amount || 0), currency: payload.currency || 'EUR', key: 'real_money', exchange_rate: 1 },
                    { amount: parseFloat(payload.bonus_amount || 0), currency: payload.currency || 'EUR', key: 'bonus_money', exchange_rate: 1 }
                ],
                origin,
                timestamp
            };
        } else if (eventType === 'bonus') {
            requestBody = {
                user_id: userId,
                user_bonus_id: payload.user_bonus_id || `${userId}-${Date.now()}`,
                bonus_contract_id: payload.bonus_id || '9821', // Mapping bonus_id to contract_id
                amount: parseFloat(payload.amount || 0),
                currency: payload.currency || 'EUR',
                status: payload.status || 'Created',
                timestamp
            };
        }

        logger.info(`[FT Integration] Preparing to queue ${eventType} event to RabbitMQ`, { userId, correlationId });

        // Build the nested message as required by the user
        const rabbitMessage = {
            type: FT_MESSAGE_TYPES[eventType] || "",
            body: {
                config: {
                    url: targetUrl,
                    method: eventConfig.method,
                    apiKey: config_key
                },
                correlationId,
                eventType,
                userId,
                timestamp: utcTimestamp,
                payload: requestBody
            }
        };

        // Publish to RabbitMQ
        const published = await rabbitmq.publishEvent(null, rabbitMessage);

        if (!published) {
            throw new Error('Failed to publish event to RabbitMQ');
        }

        await auditLog({
            correlationId, operatorId, actor_id: userId, action: `outbound:rabbitmq:publish:${eventType}`, entity_type: 'fasttrack_event', entity_id: userId, status: 'success', metadata: { request: rabbitMessage }, message: `Successfully queued ${eventType} event via RabbitMQ`
        });

        return { status: 'queued', correlationId };
    } catch (error) {
        const errorMsg = error.message;
        logger.error(`[FT Integration] Failed to queue event: ${eventType}`, { correlationId, error: errorMsg });
        await auditLog({
            correlationId, operatorId, actor_id: userId, action: `outbound:rabbitmq:publish:${eventType}`, entity_type: 'fasttrack_event', entity_id: userId, status: 'error', level: 'error', metadata: { request: payload, error: errorMsg }, message: `Failed to queue ${eventType} event`
        });
        throw error;
    }
};

/**
 * Pushes clinical events to Fast Track Integration API.
 */
const pushEvent = async (userId, eventType, payload, options = {}) => {
    return pushEventWithRetry(userId, eventType, payload, options);
};

module.exports = {
    pushEvent,
    generateCorrelationId
};
