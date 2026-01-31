const axios = require('axios');

const FT_API_URL = process.env.FT_API_URL || 'https://api.fasttrack-integration.com/v1';
const FT_API_KEY = process.env.FT_API_KEY;
const PLATFORM_ORIGIN = process.env.PLATFORM_ORIGIN || 'igaming-poc';

const activityBuffer = [];
const MAX_BUFFER_SIZE = 50;

const cleanPayload = (obj) => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
        const cleanedArr = obj.map(cleanPayload).filter(v => v !== null && v !== undefined);
        return cleanedArr.length > 0 ? cleanedArr : null;
    }
    const entries = Object.entries(obj)
        .map(([k, v]) => [k, cleanPayload(v)])
        .filter(([_, v]) => v !== null && v !== undefined && (typeof v !== 'object' || Object.keys(v).length > 0));
    return entries.length > 0 ? Object.fromEntries(entries) : null;
};

const logActivity = (type, data) => {
    activityBuffer.unshift({
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        type, // 'inbound' or 'outbound'
        ...cleanPayload(data)
    });
    if (activityBuffer.length > MAX_BUFFER_SIZE) {
        activityBuffer.pop();
    }
};

const getActivities = () => activityBuffer;

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
    'win': { path: '/v1/integration/casino', method: 'POST' }
};

const pushEvent = async (userId, eventType, payload) => {
    console.log(`[FT Integration] Pushing event: ${eventType} for user: ${userId}`, payload);

    if (!FT_API_KEY) {
        console.warn('[FT Integration] No API Key provided. Skipping actual HTTP request.');
        return;
    }

    const config = EVENT_CONFIG[eventType];
    if (!config) {
        console.error(`[FT Integration] Unknown event type: ${eventType}`);
        return;
    }

    try {
        const baseUrl = FT_API_URL.endsWith('/') ? FT_API_URL.slice(0, -1) : FT_API_URL;
        const targetUrl = `${baseUrl}${config.path}`;

        console.log(`[FT Integration] Target URL: ${targetUrl} [${config.method}]`);

        // Refine payload based on Fast Track documentation
        const origin = PLATFORM_ORIGIN;
        const timestamp = new Date().toISOString();
        let requestBody = {};

        // Event-specific data enrichment
        if (eventType === 'login') {
            requestBody = {
                user_id: userId,
                is_impersonated: payload.is_impersonated || false,
                ip_address: payload.ip_address || '127.0.0.1',
                user_agent: payload.user_agent || 'Mozilla/5.0',
                timestamp: timestamp,
                origin: origin
            };
        } else if (eventType === 'registration') {
            requestBody = {
                user_id: userId,
                note: payload.note || 'New user registration',
                user_agent: payload.user_agent || 'Mozilla/5.0',
                ip_address: payload.ip_address || '127.0.0.1',
                timestamp: timestamp, // already ISO/RFC3339
                origin: origin
            };
        } else if (eventType === 'user_update') {
            requestBody = {
                user_id: userId,
                timestamp: timestamp,
                origin: origin
            };
        } else if (eventType === 'consents') {
            requestBody = {
                user_id: userId,
                timestamp: timestamp,
                origin: origin
            };
        } else if (eventType === 'blocks') {
            requestBody = {
                user_id: userId,
                timestamp: timestamp,
                origin: origin
            };
        } else if (eventType === 'logout') {
            requestBody = {
                user_id: userId,
                timestamp: timestamp,
                origin: origin
            };
        } else if (eventType === 'deposit' || eventType === 'payment') {
            requestBody = {
                user_id: userId,
                payment_id: payload.transaction_id || `tx-${Date.now()}`,
                type: 'Credit', // Fast Track expects 'Credit' for Deposits
                status: payload.status || 'Approved', // Requested, Approved, Rejected, Rollback, Cancelled
                cashtype: 'cash',
                amount: parseFloat(payload.amount),
                currency: payload.currency || 'EUR',
                exchange_rate: payload.exchange_rate || 1.0,
                fee_amount: payload.fee_amount || 0.0,
                vendor_id: payload.vendor_id || 'mock-bank-1',
                vendor_name: payload.provider || 'MockBank',
                origin: origin,
                timestamp: timestamp
            };
            console.log(`[FT Integration] Payment payload: ${JSON.stringify(requestBody, null, 2)}`);
        } else if (eventType === 'bet' || eventType === 'win' || eventType === 'casino') {
            const real_balance_after = parseFloat(payload.balance_after || 0);
            const bonus_balance_after = parseFloat(payload.bonus_balance_after || 0);
            const real_balance_before = parseFloat(payload.balance_before || 0);
            const bonus_balance_before = parseFloat(payload.bonus_balance_before || 0);

            // Per requirement: balance before/after is TOTAL balance
            const total_balance_before = real_balance_before + bonus_balance_before;
            const total_balance_after = real_balance_after + bonus_balance_after;

            requestBody = {
                user_id: userId,
                activity_id: payload.transaction_id || `ctx-${Date.now()}`,
                type: eventType === 'win' ? 'Win' : 'Bet',
                status: 'Approved',
                amount: parseFloat(payload.amount),
                bonus_wager_amount: parseFloat(payload.bonus_wager_amount || 0),
                wager_amount: parseFloat(payload.wager_amount || 0),
                balance_after: total_balance_after,
                balance_before: total_balance_before,
                bonus_balance_after: bonus_balance_after,
                bonus_balance_before: bonus_balance_before,
                currency: payload.currency || 'EUR',
                exchange_rate: payload.exchange_rate || 1.0,
                game_id: payload.game_id || 'unknown',
                game_name: payload.game_name || 'Mock Slot Game',
                game_type: payload.game_type || 'Slot',
                vendor_id: payload.vendor_id || 'mock-vendor-1',
                vendor_name: payload.game_provider || 'MockProvider',
                round_id: payload.round_id || (payload.transaction_id ? `round-${payload.transaction_id}` : `round-${Date.now()}`),
                is_round_end: payload.is_round_end !== undefined ? payload.is_round_end : true,
                origin: origin,
                timestamp: timestamp
            };
        }
        else if (eventType === 'bonus') {
            requestBody = {
                user_id: userId,
                bonus_id: payload.bonus_id || '9821',
                user_bonus_id: payload.user_bonus_id || `${userId}-${payload.bonus_id || '9821'}`,
                type: payload.type || 'WelcomeBonus', // NoDeposit, WelcomeBonus, CashbackBonus, etc.
                status: payload.status || 'Created', // Pending, Created, Ongoing, Completed, etc.
                amount: parseFloat(payload.amount || 0),
                bonus_code: payload.bonus_code || 'WELCOME100',
                currency: payload.currency || 'EUR',
                exchange_rate: payload.exchange_rate || 1.0,
                locked_amount: parseFloat(payload.locked_amount || 0.0),
                bonus_turned_real: parseFloat(payload.bonus_turned_real || 0.0),
                required_wagering_amount: parseFloat(payload.required_wagering_amount || 0.0),
                product: payload.product || 'Casino', // Casino, Sportsbook, Lotto, Poker
                origin: origin,
                timestamp: timestamp,
                meta: payload.meta || {},
                fasttrack_references: payload.fasttrack_references || {}
            };
        } else if (eventType === 'balance') {
            requestBody = {
                user_id: userId,
                balances: payload.balances || [
                    {
                        amount: parseFloat(payload.amount || 0),
                        currency: payload.currency || 'EUR',
                        key: 'real_money',
                        exchange_rate: 1
                    },
                    {
                        amount: parseFloat(payload.bonus_amount || 0),
                        currency: payload.currency || 'EUR',
                        key: 'bonus_money',
                        exchange_rate: 1
                    }
                ],
                origin: origin,
                timestamp: timestamp
            };
        }

        const response = await axios({
            method: config.method,
            url: targetUrl,
            data: requestBody,
            headers: {
                'X-API-Key': FT_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log('[FT Integration] Event pushed successfully:', response.data);

        const telemetry = {
            method: config.method,
            endpoint: config.path,
            status: response.status,
            payload: {
                request: requestBody,
                response: response.data
            }
        };

        logActivity('outbound', telemetry);
        return telemetry;
    } catch (error) {
        console.error('[FT Integration] Failed to push event:', error.message);
        const errorTelemetry = {
            method: config ? config.method : 'UNKNOWN',
            endpoint: config ? config.path : 'UNKNOWN',
            status: error.response ? error.response.status : 500,
            payload: {
                request: requestBody || payload,
                response: error.response ? error.response.data : { error: error.message }
            }
        };
        logActivity('outbound', errorTelemetry);
        return errorTelemetry;
    }
};

module.exports = {
    pushEvent,
    logActivity,
    getActivities
};
