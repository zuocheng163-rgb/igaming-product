const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://cxjirfmrdzlcnywttjun.supabase.co', 'sb_publishable_HBs0skVzeU52Oh7Vvrcawg_IqEwAYKW');
async function run() {
  const { data, error } = await sb.from('platform_audit_logs').select('*').limit(2);
  console.log("DATA:", JSON.stringify(data, null, 2));
  console.log("ERROR:", error);
}
run();
