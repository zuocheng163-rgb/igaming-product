require('dotenv').config({path: './backend/.env'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('platform_audit_logs').select('*').limit(1).then(res => console.log(JSON.stringify(res.data, null, 2)));
