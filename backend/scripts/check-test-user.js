const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const envPaths = [
    path.join(__dirname, '../../.env.vercel'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env')
];

envPaths.forEach(p => {
    if (fs.existsSync(p)) dotenv.config({ path: p });
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserRoles() {
    console.log('Checking roles for user "test"...');
    const { data, error } = await supabase
        .from('users')
        .select('username, roles')
        .eq('username', 'test')
        .single();

    if (error) {
        console.error('Error fetching user "test":', error);
        return;
    }

    console.log('User "test" Roles:', data);
}

checkUserRoles();
