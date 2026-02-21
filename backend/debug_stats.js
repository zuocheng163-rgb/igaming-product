const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function debug() {
    const brandId = 1;
    console.log('--- Checking Audit Logs ---');
    const { data: logs, error: logsError } = await supabase
        .from('platform_audit_logs')
        .select('action, timestamp, metadata, status')
        .eq('brand_id', brandId)
        .in('action', ['wallet:debit', 'wallet:credit'])
        .limit(10);

    if (logsError) console.error('Logs Error:', logsError);
    else console.log('Sample Logs:', JSON.stringify(logs, null, 2));

    console.log('\n--- Checking Daily Stats ---');
    const { data: stats, error: statsError } = await supabase
        .from('daily_stats')
        .select('*')
        .eq('brand_id', brandId)
        .limit(5);

    if (statsError) console.error('Stats Error:', statsError);
    else console.log('Daily Stats:', JSON.stringify(stats, null, 2));

    console.log('\n--- Checking Total Event Count ---');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
        .from('platform_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('timestamp', twentyFourHoursAgo)
        .not('action', 'ilike', 'inbound:%');

    if (countError) console.error('Count Error:', countError);
    else console.log('Events Sent (24h):', count);
}

debug();
