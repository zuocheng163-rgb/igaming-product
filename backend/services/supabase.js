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
    logger.warn('[Supabase] Missing credentials.');
}

const getBrandId = (brandId) => {
    if (!brandId || brandId === 1 || brandId === '1') return 1;
    return brandId;
};

const getTenantConfig = async (brandId) => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('tenant_configs').select('*').eq('brand_id', brandId).single();
    if (error) {
        logger.error('[Supabase] Failed to fetch tenant config', { brandId, error: error.message });
        return null;
    }
    return data;
};

const updateOperatorApiKey = async (brandId, newKey) => {
    if (!supabase) return false;
    const { error } = await supabase.from('tenant_configs').upsert({
        brand_id: brandId,
        operator_name: brandId === 1 ? 'Default Operator' : `Operator ${brandId}`,
        ft_api_key: newKey,
        updated_at: new Date().toISOString()
    }, { onConflict: 'brand_id' });
    if (error) {
        logger.error('Failed to update operator API key:', { error: error.message, brandId });
        return false;
    }
    return true;
};

const saveAuditLog = async (logEntry) => {
    if (!supabase) return;
    const { error } = await supabase.from('platform_audit_logs').insert([logEntry]);
    if (error) {
        logger.error('[Supabase] Failed to save audit log', { error: error.message, correlationId: logEntry.correlation_id });
    }
};

const getUser = async (username, token) => {
    if (!supabase || !token) return null;
    let query = supabase.from('users').select('*').eq('token', token);
    if (username) query = query.eq('username', username);
    const { data, error } = await query.single();
    if (error || !data) return null;
    return data;
};

const getUserById = async (userId) => {
    if (!supabase) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    let query = supabase.from('users').select('*');
    if (isUuid) query = query.eq('id', userId);
    else query = query.or(`username.eq.${userId},user_id.eq.${userId}`);
    const { data, error } = await query.single();
    if (error) return null;
    return data;
};

const getUserConsents = async (userId) => {
    if (!supabase) return {};
    const { data, error } = await supabase.from('user_consents').select('*').eq('user_id', userId).single();
    if (error) return { email: true, sms: true, telephone: true, post_mail: true, site_notification: true, push_notification: true };
    return data;
};

const getUserBlocks = async (userId) => {
    if (!supabase) return {};
    const { data, error } = await supabase.from('user_blocks').select('*').eq('user_id', userId).single();
    if (error) return { blocked: false, excluded: false };
    return data;
};

const updateUser = async (userId, updates) => {
    if (!supabase) throw new Error('Supabase not initialized');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    let query = supabase.from('users').update(updates);
    if (isUuid) query = query.eq('id', userId);
    else query = query.or(`username.eq.${userId},user_id.eq.${userId}`);
    const { data, error } = await query.select();
    if (error) throw error;
    return data[0];
};

const createUser = async (userData) => {
    if (!supabase) throw new Error('Supabase not initialized');
    const brandId = userData.brand_id || 1;
    const publicUserId = userData.username || `user_${Date.now()}`;
    const newUser = {
        brand_id: brandId,
        user_id: publicUserId,
        username: userData.username,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        balance: userData.balance || 0,
        bonus_balance: userData.bonus_balance || 0,
        currency: userData.currency || 'EUR',
        registration_date: new Date().toISOString(),
        birth_date: userData.birth_date,
        sex: userData.sex,
        title: userData.title,
        language: userData.language,
        country: userData.country,
        city: userData.city,
        address: userData.address,
        postal_code: userData.postal_code,
        mobile: userData.mobile,
        mobile_prefix: userData.mobile_prefix,
        full_mobile_number: userData.full_mobile_number,
        origin: userData.origin,
        market: userData.market,
        registration_code: userData.registration_code,
        roles: userData.roles || ['PLAYER'],
        token: userData.token,
        ...userData
    };
    delete newUser.operator_id;
    delete newUser.operatorId;
    const { data: userRecord, error: userError } = await supabase.from('users').insert([newUser]).select().single();
    if (userError) throw userError;
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
    getBrandId,
    updateOperatorApiKey,
    getPeriodDates
};

/**
 * Helper to convert period labels to start dates
 */
function getPeriodDates(periodLabel) {
    const now = new Date();
    const start = new Date();
    let days = 30;

    switch (periodLabel) {
        case 'Today':
            start.setHours(0, 0, 0, 0);
            days = 1;
            break;
        case 'Yesterday':
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            days = 1;
            break;
        case 'Last 7 Days':
            start.setDate(now.getDate() - 7);
            days = 7;
            break;
        case 'This Month':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            days = now.getDate();
            break;
        case 'Last 30 Days':
        default:
            start.setDate(now.getDate() - 30);
            days = 30;
            break;
    }

    return { start: start.toISOString(), end: now.toISOString(), days };
}
const getActivities = async (brandId, limit = 20) => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('platform_audit_logs').select('*').or(`brand_id.eq.${brandId},brand_id.eq.1`).order('timestamp', { ascending: false }).limit(limit);
    if (error) return [];
    return data.map(log => {
        const isInbound = log.action.startsWith('inbound:');
        let method = 'POST', endpoint = log.action;
        if (isInbound) {
            method = log.action.split(':')[1]?.toUpperCase() || 'ACTION';
            endpoint = log.entity_id ? `User: ${log.entity_id}` : 'System';
        } else {
            const parts = log.action.split(':');
            if (parts.length >= 3) {
                method = 'FT-PUSH', endpoint = parts[2].toUpperCase();
            } else if (parts.length === 2 && parts[0] === 'push_event') {
                method = 'FT-PUSH', endpoint = parts[1].toUpperCase();
            }
        }
        return { id: log.id, type: isInbound ? 'inbound' : 'outbound', method, endpoint, message: log.message, status: log.status === 'success' ? 200 : 500, payload: log.metadata || {}, timestamp: log.timestamp };
    });
};

const getTransactionsByOperator = async (brandId, filters = {}) => {
    if (!supabase) return [];
    let query = supabase.from('platform_audit_logs').select('*').eq('brand_id', brandId).in('action', ['wallet:debit', 'wallet:credit', 'wallet:deposit', 'wallet:bonus_credit']);
    if (filters.startDate) query = query.gte('timestamp', filters.startDate);
    if (filters.endDate) query = query.lte('timestamp', filters.endDate);
    const { data, error } = await query.order('timestamp', { ascending: false });
    if (error) return [];
    return data;
};

const getAggregatedKPIs = async (brandId, period = 'Last 30 Days') => {
    if (!supabase) return {};

    const { start, end } = getPeriodDates(period);

    const { data: transactions, error } = await supabase
        .from('platform_audit_logs')
        .select('*')
        .eq('brand_id', brandId)
        .in('action', ['wallet:debit', 'wallet:credit', 'wallet:bonus_credit'])
        .gte('timestamp', start)
        .lte('timestamp', end);

    if (error) {
        logger.error('[Supabase] Failed to fetch KPIs', { error: error.message });
        return {};
    }

    let ggr = 0;
    let successfulTxs = 0;
    let bonuses = 0;

    transactions.forEach(tx => {
        const amount = tx.metadata?.request?.amount || 0;
        if (tx.action === 'wallet:debit') {
            ggr += amount;
            if (tx.status === 'success') successfulTxs++;
        }
        if (tx.action === 'wallet:credit') ggr -= amount;
        if (tx.action === 'wallet:bonus_credit') bonuses += amount;
    });

    const deposits = 0; // Simulated for now

    const { count: activePlayers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gt('last_login', start);

    // Bug fix: count ALL outbound events within selected period
    const { count: eventsSent } = await supabase
        .from('platform_audit_logs')
        .select('*', { count: 'exact', head: true })
        .or(`brand_id.eq.${brandId},brand_id.eq.1`)
        .gte('timestamp', start)
        .lte('timestamp', end)
        .not('action', 'ilike', 'inbound:%');

    const { count: complianceAlerts } = await supabase
        .from('platform_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .in('level', ['warn', 'error', 'critical'])
        .gte('timestamp', start)
        .lte('timestamp', end);

    const approvalRate = transactions.length > 0 ? Math.round((successfulTxs / transactions.length) * 100) : 0;

    return {
        ggr,
        ngr: ggr - bonuses,
        bonuses,
        deposits,
        transaction_count: transactions.filter(t => t.action === 'wallet:debit').length,
        active_players: activePlayers || 0,
        approval_rate: approvalRate,
        events_sent: eventsSent || 0,
        compliance_alerts: complianceAlerts || 0
    };
};

const getComplianceAlerts = async (brandId, limit = 50) => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('platform_audit_logs').select('*').eq('brand_id', brandId).in('level', ['warn', 'error', 'critical']).order('timestamp', { ascending: false }).limit(limit);
    if (error) return [];
    return data.map(log => ({ id: log.id, user: log.actor_id || 'System', trigger: log.action, risk: log.level === 'critical' ? 'High' : log.level === 'error' ? 'Medium' : 'Low', status: 'Open', date: log.timestamp, message: log.message }));
};

const getOperatorNotifications = async (brandId) => {
    if (!supabase) return [];
    const { data, error } = await supabase.from('platform_audit_logs').select('*').eq('brand_id', brandId).in('level', ['warn', 'error', 'critical']).order('timestamp', { ascending: false }).limit(10);
    if (error) return [];
    return data.map(log => ({ id: log.id, type: log.level === 'critical' ? 'alert' : 'info', title: log.action.toUpperCase(), message: log.message, time: log.timestamp, read: false }));
};

const getOperatorStats = async (brandId, period = 'Last 30 Days') => {
    if (!supabase) return {};

    const kpis = await getAggregatedKPIs(brandId, period);
    const { start, end, days } = getPeriodDates(period);

    // Try daily_stats table first (PoC often uses this for speed)
    const { data: history } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('brand_id', brandId)
        .gte('date', start.substring(0, 10))
        .lte('date', end.substring(0, 10))
        .order('date', { ascending: true })
        .limit(days);

    let demoHistory = history && history.length > 0 ? history : [];

    if (demoHistory.length === 0) {
        // Build daily GGR/NGR from wallet:debit, wallet:credit, and wallet:bonus_credit audit logs
        const { data: auditLogs } = await supabase
            .from('platform_audit_logs')
            .select('*')
            .eq('brand_id', brandId)
            .in('action', ['wallet:debit', 'wallet:credit', 'wallet:bonus_credit'])
            .gte('timestamp', start)
            .lte('timestamp', end);

        if (auditLogs && auditLogs.length > 0) {
            const byDay = {};
            auditLogs.forEach(log => {
                const day = log.timestamp.substring(0, 10); // YYYY-MM-DD
                if (!byDay[day]) byDay[day] = { date: day, ggr: 0, ngr: 0, bonuses: 0 };

                const amount = log.metadata?.request?.amount || 0;
                if (log.action === 'wallet:debit') byDay[day].ggr += amount;
                if (log.action === 'wallet:credit') byDay[day].ggr -= amount;
                if (log.action === 'wallet:bonus_credit') byDay[day].bonuses += amount;
            });

            // Calculate final NGR per day
            Object.values(byDay).forEach(d => {
                d.ngr = d.ggr - d.bonuses;
            });

            demoHistory = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
        }

        // Final Fallback: Ensure history length matches the period requested
        if (demoHistory.length < days) {
            const filledHistory = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(end);
                date.setDate(date.getDate() - i);
                const dStr = date.toISOString().substring(0, 10);
                const existing = demoHistory.find(d => d.date === dStr);
                filledHistory.push(existing || { date: dStr, ggr: 0, ngr: 0, active_players: 0, approval_rate: 0, compliance_alerts: 0, events_sent: 0 });
            }
            demoHistory = filledHistory;
        }
    }

    const lastDay = demoHistory[demoHistory.length - 1] || { ggr: 0, active_players: 0, approval_rate: 0 };
    const prevDay = demoHistory[demoHistory.length - 2] || lastDay;
    const calculateTrend = (curr, prev) => (prev && prev !== 0) ? Math.round(((curr - prev) / prev) * 100) : 0;
    const enrichment = {
        active_players: { value: kpis.active_players, trend: calculateTrend(kpis.active_players, prevDay.active_players), sparkline: demoHistory.slice(-7).map(d => d.active_players) },
        ggr: { value: kpis.ggr, trend: calculateTrend(kpis.ggr, prevDay.ggr), sparkline: demoHistory.slice(-7).map(d => d.ggr) },
        approval_rate: { value: kpis.approval_rate, trend: calculateTrend(kpis.approval_rate, prevDay.approval_rate), sparkline: demoHistory.slice(-7).map(d => d.approval_rate) },
        compliance_alerts: { value: kpis.compliance_alerts, trend: calculateTrend(kpis.compliance_alerts, prevDay.compliance_alerts), sparkline: demoHistory.slice(-7).map(d => d.compliance_alerts) },
        events_sent: { value: kpis.events_sent, trend: calculateTrend(kpis.events_sent, prevDay.events_sent), sparkline: demoHistory.slice(-7).map(d => d.events_sent) }
    };
    const recentEvents = await getActivities(brandId, 5);
    return { ...kpis, metrics: enrichment, ggr_history: demoHistory, recent_events: recentEvents };
};

const createTransaction = async (txData) => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('transactions').insert([{ transaction_id: txData.transaction_id, brand_id: txData.brand_id || 1, user_id: txData.user_id, type: txData.type, amount: txData.amount, status: txData.status || 'Success', currency: txData.currency || 'EUR', game_id: txData.game_id || null, metadata: txData.metadata || {}, created_at: new Date().toISOString() }]).select().single();
    if (error) return null;
    return data;
};

const acquireLock = async (transactionId, brandId) => {
    if (!supabase) return true;
    const { error } = await supabase.from('transaction_locks').insert([{ transaction_id: transactionId, brand_id: brandId || 1, status: 'pending', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString() }]);
    if (error) return false;
    return true;
};

const searchOperatorGlobal = async (brandId, query) => {
    if (!supabase) return { players: [], transactions: [] };
    const usersQuery = supabase.from('users').select('id, user_id, username, email, balance').eq('brand_id', brandId);
    if (query) usersQuery.or(`username.ilike.%${query}%,email.ilike.%${query}%`);
    const normalizedBrandId = getBrandId(brandId);
    const txQuery = supabase.from('transactions').select('*, users!inner(user_id, username)').eq('brand_id', normalizedBrandId).order('created_at', { ascending: false }).limit(50);
    const [usersRes, transactionsRes] = await Promise.all([usersQuery.limit(20), txQuery]);
    const transactions = (transactionsRes.data || []).map(tx => ({ ...tx, public_user_id: tx.users?.user_id || tx.users?.username || tx.user_id, user_name: tx.users?.username }));
    return { players: usersRes.data || [], transactions };
};

const getUserByIdAndBrand = async (userId, brandId) => {
    if (!supabase) return null;
    const { data, error } = await supabase.from('users').select('*').eq('brand_id', brandId).or(`user_id.eq.${userId},username.eq.${userId}`).single();
    if (error) return null;
    return data;
};

const getFilteredPlayers = async (brandId, filters, page = 1, limit = 10) => {
    if (!supabase) return { players: [], total: 0, totalPages: 0 };
    let query = supabase.from('users').select('id, user_id, username, email, balance, country, last_login', { count: 'exact' }).eq('brand_id', brandId);
    if (filters.country) query = query.ilike('country', `%${filters.country}%`);
    if (filters.username) query = query.ilike('username', `%${filters.username}%`);
    if (filters.email) query = query.ilike('email', `%${filters.email}%`);
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
    const offset = (page - 1) * limit;
    query = query.order('last_login', { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return { players: [], total: 0, totalPages: 0 };
    return { players: data || [], total: count || 0, totalPages: Math.ceil((count || 0) / limit), currentPage: page };
};

const getFilteredTransactions = async (brandId, filters, page = 1, limit = 10) => {
    if (!supabase) return { transactions: [], total: 0, totalPages: 0 };
    let query = supabase.from('transactions').select('*, users!inner(user_id, username)', { count: 'exact' }).eq('brand_id', brandId);
    if (filters.transaction_id) query = query.ilike('transaction_id', `%${filters.transaction_id}%`);
    if (filters.user) query = query.ilike('users.username', `%${filters.user}%`);
    if (filters.type) query = query.ilike('type', `%${filters.type}%`);
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
    if (filters.status) query = query.ilike('status', `%${filters.status}%`);
    const offset = (page - 1) * limit;
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) return { transactions: [], total: 0, totalPages: 0 };
    const transactions = (data || []).map(tx => ({ ...tx, public_user_id: tx.users?.user_id || tx.users?.username || tx.user_id, user: tx.users?.username || tx.user_id }));
    return { transactions, total: count || 0, totalPages: Math.ceil((count || 0) / limit), currentPage: page };
};

const getOperationalStream = async (brandId, page = 1, limit = 20, type = null) => {
    if (!supabase) return { events: [], total: 0, totalPages: 0 };
    let query = supabase.from('platform_audit_logs').select('*', { count: 'exact' }).or(`brand_id.eq.${brandId},brand_id.eq.1`);
    if (type === 'inbound') query = query.ilike('action', 'inbound:%');
    else if (type === 'outbound') query = query.not('action', 'ilike', 'inbound:%');
    const { data, error, count } = await query.order('timestamp', { ascending: false }).limit(100);
    if (error) return { events: [], total: 0, totalPages: 0 };
    const allEvents = (data || []).map(log => {
        const isInbound = log.action.startsWith('inbound:');
        let method = 'POST', endpoint = log.action;
        if (isInbound) {
            method = log.action.split(':')[1]?.toUpperCase() || 'ACTION';
            endpoint = log.entity_id ? `User: ${log.entity_id}` : 'System';
        } else {
            const parts = log.action.split(':');
            if (parts.length >= 3) {
                method = 'FT-PUSH', endpoint = parts[2].toUpperCase();
            } else if (parts.length === 2 && parts[0] === 'push_event') {
                method = 'FT-PUSH', endpoint = parts[1].toUpperCase();
            }
        }
        return { id: log.id, type: isInbound ? 'inbound' : 'outbound', method, endpoint, message: log.message, status: log.status === 'success' ? 200 : 500, payload: log.metadata || {}, timestamp: log.timestamp };
    });
    const offset = (page - 1) * limit;
    const paginatedEvents = allEvents.slice(offset, offset + limit);
    return { events: paginatedEvents, total: Math.min(allEvents.length, 100), totalPages: Math.ceil(Math.min(allEvents.length, 100) / limit), currentPage: page };
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
    getComplianceAlerts,
    getOperatorNotifications,
    getOperatorStats,
    searchOperatorGlobal,
    getUserByIdAndBrand,
    createTransaction,
    acquireLock,
    getFilteredPlayers,
    getFilteredTransactions,
    getOperationalStream,
    getBrandId,
    updateOperatorApiKey
};
