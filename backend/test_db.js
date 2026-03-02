const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://cxjirfmrdzlcnywttjun.supabase.co', 'sb_publishable_HBs0skVzeU52Oh7Vvrcawg_IqEwAYKW');
sb.from('platform_audit_logs').select('*').limit(2).then(res => console.log(JSON.stringify(res.data, null, 2))).catch(console.error);
