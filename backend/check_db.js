const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function checkConfig() {
    console.log('--- Testing Upsert ---');
    const { data: upsertData, error: upsertError } = await supabase.from('tenant_configs').upsert({
        brand_id: 1,
        operator_name: 'Default Operator',
        ft_api_key: 'test-key-' + Date.now(),
        updated_at: new Date().toISOString()
    }, { onConflict: 'brand_id' });

    if (upsertError) {
        console.error('Upsert Error:', upsertError);
    } else {
        console.log('Upsert Success!');
    }

    const { data, error } = await supabase.from('tenant_configs').select('*').eq('brand_id', 1);
    console.log('Tenant Configs for brand_id=1:');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }

    const { data: users, error: userError } = await supabase.from('users').select('username, roles, token').in('username', ['admin', 'test01']);
    console.log('\nPortal Evaluation Users:');
    if (userError) {
        console.error('Error:', userError);
    } else {
        console.log(JSON.stringify(users, null, 2));
    }
}

checkConfig();
