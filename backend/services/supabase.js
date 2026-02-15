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
    console.log('[DEBUG] Env check:', {
        url: !!supabaseUrl,
        key: !!supabaseKey,
        serviceKey: !!supabaseServiceKey
    });
    logger.warn('[Supabase] Missing credentials. Backend will fail to perform DB operations.');
}

/**
 * Helper to map operator_id (string) to brand_id (int)
 */
const getBrandId = (brandId) => {
    // Standardize to numeric 1 if falsy, '1', or 1.
    // We remove the 'default' string mapping to ensure DB consistency.
    if (!brandId || brandId === 1 || brandId === '1') return 1;
    return brandId;
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
            if (log.action === 'inbound:userdetails') endpoint = 'FT: GET UserDetails';
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
            message: log.message,
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
    if (!supabase) return { ggr: 0, ngr: 0, deposits: 0, active_players: 0, approval_rate: 0 };

    const transactions = await getTransactionsByOperator(brandId);

    let ggr = 0;
    let deposits = 0;
    let bonuses = 0;
    let successfulTxs = 0;

    transactions.forEach(tx => {
        const amount = tx.metadata?.request?.amount || 0;
        if (tx.action === 'wallet:debit') ggr += amount;
        if (tx.action === 'wallet:credit') ggr -= amount;
        if (tx.action === 'wallet:deposit') deposits += amount;
        if (tx.action === 'wallet:bonus_credit') bonuses += amount;
        if (tx.status === 'success') successfulTxs++;
    });

    // 1. Calculate Active Players (Unique users with transactions in last 24h)
    let activePlayers = new Set(transactions.map(tx => tx.user_id)).size;

    // Fallback: If no transactions, count users logged in within last 24h
    if (activePlayers === 0) {
        const { count } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .gt('last_login', new Date(Date.now() - 86400000).toISOString());
        activePlayers = count || 0;
    }

    const approvalRate = transactions.length > 0 ? Math.round((successfulTxs / transactions.length) * 100) : 98;

    return {
        ggr,
        ngr: ggr - bonuses,
        deposits,
        transaction_count: transactions.length,
        active_players: activePlayers,
        approval_rate: approvalRate
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

const getOperatorNotifications = async (brandId, limit = 50) => {
    if (!supabase) return [];

    // Fetch recent high-priority audit logs as notifications
    const { data, error } = await supabase
        .from('platform_audit_logs')
        .select('*')
        .eq('brand_id', brandId)
        .in('level', ['warn', 'error', 'critical'])
        .order('timestamp', { ascending: false })
        .limit(limit);

    if (error) {
        logger.error('[Supabase] Failed to fetch operator notifications', { error: error.message });
        return [];
    }

    // Map audit logs to notification format
    return (data || []).map(log => ({
        id: log.id,
        type: log.level === 'critical' ? 'critical' : log.level === 'error' ? 'alert' : 'warning',
        title: log.action || 'System Event',
        message: log.message || `${log.action} event detected`,
        timestamp: log.timestamp,
        severity: log.level,
        user_id: log.actor_id,
        metadata: log.metadata
    }));
};

const getOperatorStats = async (brandId) => {
    if (!supabase) return {};

    // 1. Fetch KPI Strip stats
    const kpis = await getAggregatedKPIs(brandId);

    // 2. Fetch history for trends and sparklines
    const { data: history, error: historyError } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('brand_id', brandId)
        .order('date', { ascending: true })
        .limit(30);

    // 3. Realistic Demo Data Fallback
    const demoHistory = history?.length > 0 ? history : [
        { date: '2026-02-04', ggr: 1240, active_players: 85, ngr: 1100, approval_rate: 97 },
        { date: '2026-02-05', ggr: 1350, active_players: 90, ngr: 1200, approval_rate: 98 },
        { date: '2026-02-06', ggr: 1100, active_players: 88, ngr: 950, approval_rate: 96 },
        { date: '2026-02-07', ggr: 1600, active_players: 105, ngr: 1400, approval_rate: 99 },
        { date: '2026-02-08', ggr: 1850, active_players: 112, ngr: 1600, approval_rate: 98 },
        { date: '2026-02-09', ggr: 1700, active_players: 110, ngr: 1550, approval_rate: 97 },
        { date: '2026-02-10', ggr: 2100, active_players: 124, ngr: 1800, approval_rate: 98 },
    ];

    const lastDay = demoHistory[demoHistory.length - 1];
    const prevDay = demoHistory[demoHistory.length - 2] || lastDay;

    // Calculate trends based on the last 2 records
    const calculateTrend = (current, previous) => {
        if (!previous) return 0;
        return Math.round(((current - previous) / previous) * 100);
    };

    // 4. Enrich KPIs with trends and sparklines
    const enrichment = {
        active_players: {
            value: kpis.active_players,
            trend: calculateTrend(lastDay.active_players, prevDay.active_players),
            sparkline: demoHistory.slice(-7).map(d => d.active_players)
        },
        ggr: {
            value: kpis.ggr || lastDay.ggr,
            trend: calculateTrend(lastDay.ggr, prevDay.ggr),
            sparkline: demoHistory.slice(-7).map(d => d.ggr)
        },
        approval_rate: {
            value: kpis.approval_rate,
            trend: calculateTrend(lastDay.approval_rate, prevDay.approval_rate),
            sparkline: demoHistory.slice(-7).map(d => d.approval_rate)
        },
        compliance_alerts: {
            value: 4,
            trend: -20, // Improving
            sparkline: [8, 7, 6, 6, 5, 4, 4]
        }
    };

    const recentEvents = await getActivities(brandId, 5);

    return {
        ...kpis, // Legacy support
        metrics: enrichment,
        ggr_history: demoHistory,
        recent_events: recentEvents
    };
};

const createTransaction = async (txData) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('transactions')
        .insert([{
            transaction_id: txData.transaction_id,
            brand_id: txData.brand_id || 1,
            user_id: txData.user_id, // Internal UUID
            type: txData.type,
            amount: txData.amount,
            currency: txData.currency || 'EUR',
            game_id: txData.game_id || null,
            metadata: txData.metadata || {},
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) {
        logger.error('[Supabase] Failed to create transaction record', { error: error.message, txId: txData.transaction_id });
        return null;
    }
    return data;
};

const acquireLock = async (transactionId, brandId) => {
    if (!supabase) return true; // Fail open in dev if needed, but safer to return true

    const { error } = await supabase
        .from('transaction_locks')
        .insert([{
            transaction_id: transactionId,
            brand_id: brandId || 1,
            status: 'pending',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60000).toISOString()
        }]);

    if (error) {
        if (error.code === '23505') { // Unique violation
            return false;
        }
        logger.error('[Supabase] Lock acquisition error', { error: error.message, txId: transactionId });
        return false;
    }
    return true;
};

const searchOperatorGlobal = async (brandId, query) => {
    if (!supabase) return { players: [], transactions: [] };

    // 1. Search Users
    const usersQuery = supabase.from('users')
        .select('id, user_id, username, email, balance')
        .eq('brand_id', brandId);

    if (query) {
        usersQuery.or(`username.ilike.%${query}%,email.ilike.%${query}%`);
    }

    // 2. Search Transactions (joined with users for public user_id)
    const normalizedBrandId = getBrandId(brandId);

    const txQuery = supabase.from('transactions')
        .select('*, users!inner(user_id, username)')
        .eq('brand_id', normalizedBrandId)
        .order('created_at', { ascending: false })
        .limit(50);

    const [usersRes, transactionsRes] = await Promise.all([
        usersQuery.limit(20),
        txQuery
    ]);

    // Flatten transaction results to include public user identifier
    const transactions = (transactionsRes.data || []).map(tx => ({
        ...tx,
        public_user_id: tx.users?.user_id || tx.users?.username || tx.user_id,
        user_name: tx.users?.username
    }));

    return {
        players: usersRes.data || [],
        transactions: transactions
    };
};

const getUserByIdAndBrand = async (userId, brandId) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('brand_id', brandId)
        .or(`user_id.eq.${userId},username.eq.${userId}`)
        .single();

    if (error) {
        logger.error('[Supabase] Failed to fetch user by ID and brand', { userId, brandId, error: error.message });
        return null;
    }

    return data;
};

const getFilteredPlayers = async (brandId, filters, page = 1, limit = 10) => {
    if (!supabase) return { players: [], total: 0, totalPages: 0 };

    let query = supabase.from('users')
        .select('id, user_id, username, email, balance, country, last_login', { count: 'exact' })
        .eq('brand_id', brandId);

    // Apply filters
    if (filters.country) {
        query = query.ilike('country', `%${filters.country}%`);
    }
    if (filters.username) {
        query = query.ilike('username', `%${filters.username}%`);
    }
    if (filters.email) {
        query = query.ilike('email', `%${filters.email}%`);
    }
    if (filters.balance) {
        const { operator, value } = filters.balance;
        if (operator === '>') query = query.gt('balance', value);
        else if (operator === '>=') query = query.gte('balance', value);
        else if (operator === '=') query = query.eq('balance', value);
        else if (operator === '<') query = query.lt('balance', value);
        else if (operator === '<=') query = query.lte('balance', value);
    }
    if (filters.last_login) {
        const { operator, value } = filters.last_login;
        if (operator === '>') query = query.gt('last_login', value);
        else if (operator === '>=') query = query.gte('last_login', value);
        else if (operator === '=') query = query.eq('last_login', value);
        else if (operator === '<') query = query.lt('last_login', value);
        else if (operator === '<=') query = query.lte('last_login', value);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.order('last_login', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        logger.error('[Supabase] Failed to fetch filtered players', { error: error.message });
        return { players: [], total: 0, totalPages: 0 };
    }

    return {
        players: data || [],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
    };
};

const getFilteredTransactions = async (brandId, filters, page = 1, limit = 10) => {
    if (!supabase) return { transactions: [], total: 0, totalPages: 0 };

    let query = supabase.from('transactions')
        .select('*, users!inner(user_id, username)', { count: 'exact' })
        .eq('brand_id', brandId);

    // Apply filters
    if (filters.transaction_id) {
        query = query.ilike('transaction_id', `%${filters.transaction_id}%`);
    }
    if (filters.user) {
        query = query.or(`users.username.ilike.%${filters.user}%,users.user_id.ilike.%${filters.user}%`);
    }
    if (filters.type) {
        query = query.ilike('type', `%${filters.type}%`);
    }
    if (filters.amount) {
        const { operator, value } = filters.amount;
        if (operator === '>') query = query.gt('amount', value);
        else if (operator === '>=') query = query.gte('amount', value);
        else if (operator === '=') query = query.eq('amount', value);
        else if (operator === '<') query = query.lt('amount', value);
        else if (operator === '<=') query = query.lte('amount', value);
    }
    if (filters.date) {
        const { operator, value } = filters.date;
        if (operator === '>') query = query.gt('created_at', value);
        else if (operator === '>=') query = query.gte('created_at', value);
        else if (operator === '=') query = query.eq('created_at', value);
        else if (operator === '<') query = query.lt('created_at', value);
        else if (operator === '<=') query = query.lte('created_at', value);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        logger.error('[Supabase] Failed to fetch filtered transactions', { error: error.message });
        return { transactions: [], total: 0, totalPages: 0 };
    }

    // Format transactions
    const transactions = (data || []).map(tx => ({
        ...tx,
        public_user_id: tx.users?.user_id || tx.users?.username || tx.user_id,
        user: tx.users?.username || tx.user_id
    }));

    return {
        transactions,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        currentPage: page
    };
};

const getOperationalStream = async (brandId, page = 1, limit = 20) => {
    if (!supabase) return { events: [], total: 0, totalPages: 0 };

    // Fetch most recent 100 events, paginate client-side for simplicity
    const { data, error, count } = await supabase
        .from('platform_audit_logs')
        .select('*', { count: 'exact' })
        .or(`brand_id.eq.${brandId},brand_id.eq.1`)
        .order('timestamp', { ascending: false })
        .limit(100);

    if (error) {
        logger.error('[Supabase] Failed to fetch operational stream', { error: error.message });
        return { events: [], total: 0, totalPages: 0 };
    }

    // Format events
    const allEvents = (data || []).map(log => {
        const isInbound = log.action.startsWith('inbound:');
        let method = 'POST';
        let endpoint = log.action;

        if (isInbound) {
            method = log.action.split(':')[1]?.toUpperCase() || 'ACTION';
            endpoint = log.entity_id ? `User: ${log.entity_id}` : 'System';
            if (log.metadata?.consents) endpoint = 'Update Consents';
            if (log.metadata?.blocks) endpoint = 'Update Blocks';
            if (log.action === 'inbound:userdetails') endpoint = 'FT: GET UserDetails';
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
            message: log.message,
            status: log.status === 'success' ? 200 : 500,
            payload: log.metadata || {},
            timestamp: log.timestamp
        };
    });

    // Paginate
    const offset = (page - 1) * limit;
    const paginatedEvents = allEvents.slice(offset, offset + limit);

    return {
        events: paginatedEvents,
        total: Math.min(allEvents.length, 100),
        totalPages: Math.ceil(Math.min(allEvents.length, 100) / limit),
        currentPage: page
    };
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
    getAggregatedKPIs,
    getOperatorNotifications,
    getOperatorStats,
    searchOperatorGlobal,
    getUserByIdAndBrand,
    createTransaction,
    acquireLock,
    getFilteredPlayers,
    getFilteredTransactions,
    getOperationalStream
};
