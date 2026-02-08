const { createClient } = require('@supabase/supabase-js');
const { logger } = require('./logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
if (supabaseUrl && (supabaseServiceKey || supabaseKey)) {
    supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);
    logger.info('[Supabase] Client initialized');
} else {
    logger.warn('[Supabase] Missing credentials. Backend will fail to perform DB operations.');
}

/**
 * Helper to map operator_id (string) to brand_id (int)
 */
const getBrandId = (brandId) => {
    return brandId || 1;
};

/**
 * Fetches dynamic configuration for a specific operator.
 */
const getTenantConfig = async (brandId) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('tenant_configs')
        .select('*')
        .eq('brand_id', brandId)
        .single();

    if (error) {
        logger.error(`[Supabase] Failed to fetch tenant config for ${brandId}`, { error: error.message });
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

    let query = supabase
        .from('users')
        .select('*')
        .eq('token', token);

    // Extra validation if username is provided
    if (username) {
        query = query.eq('username', username);
    }

    const { data, error } = await query.single();

    if (error || !data) {
        logger.debug(`[Supabase] User not found by token/username`, { username, hasToken: !!token });
        return null;
    }

    logger.info(`[Supabase] User fetched successfully`, {
        userId: data.user_id,
        username: data.username,
        balance: data.balance,
        bonus_balance: data.bonus_balance,
        currency: data.currency,
        raw_keys: Object.keys(data)
    });

    return data;
};

const getUserById = async (userId) => {
    if (!supabase) return null;

    // Fast Track often uses username as user_id or a unique string
    // We try to match by internal id (uuid), username, or the public user_id field
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

    let query = supabase.from('users').select('*');
    if (isUuid) {
        query = query.eq('id', userId);
    } else {
        // Try matching both username and the specific user_id column
        query = query.or(`username.eq.${userId},user_id.eq.${userId}`);
    }

    const { data, error } = await query.single();
    if (error) return null;
    return data;
};

const updateUser = async (userId, updates) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

    let query = supabase.from('users').update(updates);
    if (isUuid) {
        query = query.eq('id', userId);
    } else {
        query = query.or(`username.eq.${userId},user_id.eq.${userId}`);
    }

    const { data, error } = await query.select();

    if (error) {
        logger.error(`[Supabase] Update failed for user ${userId}`, { error: error.message });
        throw error;
    }
    return data[0];
};

const createUser = async (userData) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const brandId = userData.brand_id || 1;
    const publicUserId = userData.username || `user_${Date.now()}`;

    // 1. Create User Profile
    const newUser = {
        brand_id: brandId,
        user_id: publicUserId,
        username: userData.username,
        email: userData.email,
        first_name: userData.first_name || 'Demo',
        last_name: userData.last_name || 'User',
        balance: 1000,
        bonus_balance: 500,
        currency: 'EUR',
        registration_date: new Date().toISOString(),
        birth_date: userData.birth_date || '1990-01-01',
        sex: userData.sex || 'male',
        title: userData.title || 'Mr',
        language: userData.language || 'en',
        country: userData.country || 'MT',
        city: userData.city || 'Valletta',
        address: userData.address || '123 Casino Way',
        postal_code: userData.postal_code || 'VLT 1234',
        mobile: userData.mobile || '35699123456',
        mobile_prefix: userData.mobile_prefix || '356',
        full_mobile_number: userData.full_mobile_number || '35699123456',
        origin: userData.origin || 'Direct',
        market: userData.market || 'INT',
        registration_code: userData.registration_code || 'WELCOME2026',
        roles: ['PLAYER'],
        token: userData.token,
        ...userData
    };

    // Sanitize the object to ensure no legacy fields (like operator_id) hit the DB
    delete newUser.operator_id;
    delete newUser.operatorId;

    const { data: userRecord, error: userError } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();

    if (userError) {
        logger.error('[Supabase] User creation failed', { error: userError.message });
        throw userError;
    }

    // 2. Initialize Consents
    const initialConsents = {
        brand_id: brandId,
        user_id: publicUserId,
        allow_marketing_communication: true,
        email: true,
        sms: true,
        telephone: true,
        post_mail: true,
        site_notification: true,
        push_notification: true
    };

    await supabase.from('user_consents').insert([initialConsents]);

    // 3. Initialize Blocks
    const initialBlocks = {
        brand_id: brandId,
        user_id: publicUserId,
        blocked: false,
        excluded: false
    };

    await supabase.from('user_blocks').insert([initialBlocks]);

    return userRecord;
};

const updateBalance = async (userId, newBalance, brandId) => {
    return updateUser(userId, { balance: newBalance });
};

const getActivities = async (brandId, limit = 20) => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('platform_audit_logs')
        .select('*')
        .or(`brand_id.eq.${brandId},brand_id.eq.1`)
        .order('timestamp', { ascending: false })
        .limit(limit);

    if (error) {
        logger.error('[Supabase] Failed to fetch activities', { error: error.message });
        return [];
    }

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
            const parts = log.action.split(':');
            if (parts.length >= 3) {
                method = 'FT-PUSH';
                endpoint = parts[2].toUpperCase();
            } else if (parts.length === 2 && parts[0] === 'push_event') {
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

const getTransactionsByOperator = async (brandId, filters = {}) => {
    if (!supabase) return [];

    let query = supabase
        .from('platform_audit_logs')
        .select('*')
        .eq('brand_id', brandId)
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

const getAggregatedKPIs = async (brandId) => {
    if (!supabase) return { ggr: 0, ngr: 0, deposits: 0 };

    const transactions = await getTransactionsByOperator(brandId);

    let ggr = 0;
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
        ngr: ggr - bonuses,
        deposits,
        transaction_count: transactions.length
    };
};

const getUserConsents = async (userId) => {
    if (!supabase) return null;

    // Fetch from the new normalized table
    const { data, error } = await supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        // Fallback to defaults if not found
        return {
            brand_id: 1,
            user_id: userId,
            email: true,
            sms: true,
            telephone: true,
            post_mail: true,
            site_notification: true,
            push_notification: true
        };
    }

    return data;
};

const getUserBlocks = async (userId) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('user_blocks')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        return {
            brand_id: 1,
            user_id: userId,
            blocked: false,
            excluded: false
        };
    }

    return data;
};

module.exports = {
    client: supabase,
    getTenantConfig,
    saveAuditLog,
    getUser,
    getUserById,
    getUserConsents,
    getUserBlocks,
    updateUser,
    createUser,
    updateBalance,
    getActivities,
    getTransactionsByOperator,
    getAggregatedKPIs
};
