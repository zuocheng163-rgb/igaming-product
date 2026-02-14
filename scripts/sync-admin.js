const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncAdmin() {
    const targetToken = 'token-admin-1770392488236';
    console.log(`Syncing admin user with token ${targetToken}...`);

    const { data, error } = await supabase
        .from('users')
        .update({
            token: targetToken,
            roles: ['ADMIN']
        })
        .eq('username', 'admin')
        .select();

    if (error) {
        console.error('Update failed:', error.message);
    } else {
        console.log('Update successful:', data);
    }
}

syncAdmin();
