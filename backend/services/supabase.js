const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Optional but recommended for S2S

let supabase;
if (supabaseUrl && (supabaseServiceKey || supabaseKey)) {
    supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);
    logger.info('[Supabase] Client initialized');
} else {
    logger.warn('[Supabase] Missing credentials. Backend will fail to perform DB operations.');
}

/**
 * Fetches dynamic configuration for a specific operator.
 */
const getTenantConfig = async (operatorId) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('tenant_configs')
        .select('*')
        .eq('operator_id', operatorId)
        .single();

    if (error) {
        logger.error(`[Supabase] Failed to fetch tenant config for ${operatorId}`, { error: error.message });
        return null;
    }

    return data;
};

/**
 * Persists an audit log entry to Supabase.
 */
const saveAuditLog = async (logEntry) => {
    if (!supabase) return;

    const { error } = await supabase
        .from('platform_audit_logs')
        .insert([logEntry]);

    if (error) {
        logger.error('[Supabase] Failed to save audit log', { error: error.message, correlationId: logEntry.correlation_id });
    }
};

const getUser = async (username, token) => {
    if (!supabase || !token) return null;

    const { data, error } = await supabase
        .from('user_details')
        .select('*')
        .eq('token', token)
        .single();

    if (error || !data) {
        logger.debug(`[Supabase] User not found by token`, { username });
        return null;
    }

    return data;
};

const getUserById = async (userId) => {
    if (!supabase) {
        if (process.env.DEMO_MODE === 'true') {
            return {
                id: userId, // Use the provided string as the ID in demo mode
                username: userId, // Use the provided string as the username
                email: 'demo@neostrike.io',
                balance: 1000,
                bonus_balance: 500,
                currency: 'EUR',
                country: 'MT',
                operator_id: 'default'
            };
        }
        return null;
    }

    // Basic UUID validation regex
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

    let query = supabase.from('user_details').select('*');
    if (isUuid) {
        query = query.eq('id', userId);
    } else {
        query = query.eq('username', userId);
    }

    const { data, error } = await query.single();
    if (error) return null;
    return data;
};

const updateUser = async (userId, updates) => {
    if (!supabase) {
        if (process.env.DEMO_MODE === 'true') {
            return { id: userId, ...updates };
        }
        throw new Error('Supabase not initialized');
    }

    const { data, error } = await supabase
        .from('user_details')
        .update(updates)
        .eq('id', userId)
        .select();

    if (error) {
        logger.error(`[Supabase] Update failed for user ${userId}`, { error: error.message });
        throw error;
    }
    return data[0];
};

const createUser = async (userData) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const newUser = {
        balance: 1000,
        currency: 'EUR',
        registration_date: new Date().toISOString(),
        operator_id: userData.operator_id || 'default',
        ...userData
    };

    const { data, error } = await supabase
        .from('user_details')
        .insert([newUser])
        .select();

    if (error) {
        logger.error('[Supabase] User creation failed', { error: error.message });
        throw error;
    }
    return data[0];
};

/**
 * Atomic balance update using PostgreSQL Transactions placeholder
 * (Will be fully implemented in WalletService)
 */
const updateBalance = async (userId, newBalance, operatorId) => {
    return updateUser(userId, { balance: newBalance });
};

const getActivities = async (operatorId, limit = 20) => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('platform_audit_logs')
        .select('*')
        .or(`operator_id.eq.${operatorId},operator_id.eq.default`) // Fetch both specific and default (fallback) logs
        .order('timestamp', { ascending: false })
        .limit(limit);

    if (error) {
        logger.error('[Supabase] Failed to fetch activities', { error: error.message });
        return [];
    }

    // Map DB logs to Frontend Activity format
    return data.map(log => {
        const isInbound = log.action.startsWith('inbound:');
        let method = 'POST';
        let endpoint = log.action;

        if (isInbound) {
            method = log.action.split(':')[1]?.toUpperCase() || 'ACTION';
            endpoint = log.entity_id ? `User: ${log.entity_id}` : 'System';
            if (log.metadata?.consents) endpoint = 'Update Consents';
            if (log.metadata?.blocks) endpoint = 'Update Blocks';
        } else {
            // Outbound logic (e.g. outbound:push_event:login or push_event:login)
            const parts = log.action.split(':');
            if (parts.length >= 3) {
                // Format: outbound:push_event:login
                method = 'FT-PUSH';
                endpoint = parts[2].toUpperCase();
            } else if (parts.length === 2 && parts[0] === 'push_event') {
                // Format: push_event:login (Legacy)
                method = 'FT-PUSH';
                endpoint = parts[1].toUpperCase();
            }
        }

        return {
            id: log.id,
            type: isInbound ? 'inbound' : 'outbound',
            method: method,
            endpoint: endpoint,
            status: log.status === 'success' ? 200 : 500,
            payload: log.metadata || {},
            timestamp: log.timestamp
        };
    });
};

/**
 * Fetches transaction-level data for reporting.
 */
const getTransactionsByOperator = async (operatorId, filters = {}) => {
    if (!supabase) return [];

    let query = supabase
        .from('platform_audit_logs')
        .select('*')
        .eq('operator_id', operatorId)
        .in('action', ['wallet:debit', 'wallet:credit', 'wallet:deposit', 'wallet:bonus_credit']);

    if (filters.startDate) query = query.gte('timestamp', filters.startDate);
    if (filters.endDate) query = query.lte('timestamp', filters.endDate);

    const { data, error } = await query.order('timestamp', { ascending: false });

    if (error) {
        logger.error('[Supabase] Failed to fetch transactions', { error: error.message });
        return [];
    }

    return data;
};

/**
 * Basic KPI Aggregation Mock (In production, this would be an RPC)
 */
const getAggregatedKPIs = async (operatorId) => {
    if (!supabase) return { ggr: 0, ngr: 0, deposits: 0 };

    // In PoC, we aggregate manually for demonstration
    const transactions = await getTransactionsByOperator(operatorId);

    let ggr = 0; // Tot Bets - Tot Wins
    let deposits = 0;
    let bonuses = 0;

    transactions.forEach(tx => {
        const amount = tx.metadata?.request?.amount || 0;
        if (tx.action === 'wallet:debit') ggr += amount;
        if (tx.action === 'wallet:credit') ggr -= amount;
        if (tx.action === 'wallet:deposit') deposits += amount;
        if (tx.action === 'wallet:bonus_credit') bonuses += amount;
    });

    return {
        ggr,
        ngr: ggr - bonuses, // Simplified NGR
        deposits,
        transaction_count: transactions.length
    };
};

module.exports = {
    client: supabase, // Export the client for services like Monitoring
    getTenantConfig,
    saveAuditLog,
    getUser,
    getUserById,
    updateUser,
    createUser,
    updateBalance,
    getActivities,
    getTransactionsByOperator,
    getAggregatedKPIs
};
