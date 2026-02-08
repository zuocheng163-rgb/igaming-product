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
        const timestamp = new Date().toISOString();
        let requestBody = {};

        // Event enrichment logic (same as before)
        if (eventType === 'login') {
            requestBody = { user_id: userId, is_impersonated: payload.is_impersonated || false, ip_address: payload.ip_address || '127.0.0.1', user_agent: payload.user_agent || 'Mozilla/5.0', timestamp, origin };
        } else if (eventType === 'registration') {
            requestBody = { user_id: userId, note: payload.note || 'New registration', user_agent: payload.user_agent || 'Mozilla/5.0', ip_address: payload.ip_address || '127.0.0.1', timestamp, origin };
        } else if (['user_update', 'consents', 'consent', 'blocks', 'block', 'logout'].includes(eventType)) {
            requestBody = { user_id: userId, timestamp, origin, ...payload };
        } else if (eventType === 'deposit' || eventType === 'payment') {
            requestBody = { user_id: userId, payment_id: payload.transaction_id || `tx-${Date.now()}`, type: 'Credit', status: payload.status || 'Approved', cashtype: 'cash', amount: parseFloat(payload.amount), currency: payload.currency || 'EUR', exchange_rate: 1.0, origin, timestamp };
        } else if (eventType === 'bet' || eventType === 'win' || eventType === 'casino') {
            requestBody = {
                user_id: userId,
                activity_id: payload.transaction_id || `ctx-${Date.now()}`,
                type: (eventType === 'win' || payload.type === 'Win') ? 'Win' : 'Bet',
                status: 'Approved',
                amount: parseFloat(payload.amount),
                bonus_wager_amount: parseFloat(payload.bonus_wager_amount || 0),
                wager_amount: parseFloat(payload.wager_amount || 0),
                balance_after: parseFloat(payload.balance_after || 0),
                balance_before: parseFloat(payload.balance_before || 0),
                bonus_balance_after: parseFloat(payload.bonus_balance_after || 0),
                bonus_balance_before: parseFloat(payload.bonus_balance_before || 0),
                currency: payload.currency || 'EUR',
                exchange_rate: 1.0,
                game_id: payload.game_id || 'unknown',
                game_name: payload.game_name || 'Mock Slot Game',
                game_type: payload.game_type || 'Slot',
                vendor_id: payload.vendor_id || 'mock-vendor-1',
                vendor_name: payload.game_provider || 'MockProvider',
                round_id: payload.round_id || (payload.transaction_id ? `round-${payload.transaction_id}` : `round-${Date.now()}`),
                is_round_end: payload.is_round_end !== undefined ? payload.is_round_end : true,
                origin,
                timestamp
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
            requestBody = { user_id: userId, bonus_id: payload.bonus_id || '9821', user_bonus_id: payload.user_bonus_id || `${userId}-${Date.now()}`, type: payload.type || 'WelcomeBonus', status: payload.status || 'Created', amount: parseFloat(payload.amount || 0), bonus_code: payload.bonus_code || 'WELCOME100', product: payload.product || 'Casino', currency: payload.currency || 'EUR', exchange_rate: 1.0, origin, timestamp };
        }

        logger.info(`[FT Integration] Preparing to queue ${eventType} event to RabbitMQ`, { userId, correlationId });

        // Publish to RabbitMQ instead of direct Axios call
        const published = await rabbitmq.publishEvent(null, {
            userId,
            eventType,
            payload: requestBody,
            config: {
                url: targetUrl,
                method: eventConfig.method,
                apiKey: config_key
            },
            correlationId
        });

        if (!published) {
            throw new Error('Failed to publish event to RabbitMQ');
        }

        await auditLog({
            correlationId, operatorId, actor_id: userId, action: `outbound:rabbitmq:publish:${eventType}`, entity_type: 'fasttrack_event', entity_id: userId, status: 'success', metadata: { request: requestBody }, message: `Successfully queued ${eventType} event via RabbitMQ`
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
