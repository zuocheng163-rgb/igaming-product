const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmin() {
    console.log('Fetching all users...');
    const { data, error } = await supabase
        .from('users')
        .select('*');

    if (error) {
        console.error('Error fetching users:', error.message);
    } else if (data && data.length > 0) {
        console.log(`Found ${data.length} users:`);
        data.forEach(u => {
            console.log(`- Username: ${u.username}, Token: ${u.token}, Roles: ${u.roles}`);
        });
    } else {
        console.log('No users found in the database.');
    }
}

checkAdmin();
