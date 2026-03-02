require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
sb.from('platform_audit_logs').select('*').limit(1).then(res => console.log(JSON.stringify(res.data, null, 2))).catch(console.error);
