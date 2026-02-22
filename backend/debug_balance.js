const dotenv = require('dotenv');
dotenv.config();
const supabaseService = require('./services/supabase');

async function check() {
    try {
        const { data } = await supabaseService.client.from('users').select('*').eq('username', 'test01');
        console.log('All test01 records:', data);
    } catch (e) {
        console.error('Check failed:', e.message);
    }
}

check();
