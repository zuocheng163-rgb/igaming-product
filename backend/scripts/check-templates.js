const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Try various locations for .env files
const envPaths = [
    path.join(__dirname, '../../.env.vercel'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env')
];

envPaths.forEach(p => {
    if (fs.existsSync(p)) {
        console.log(`Loading env from ${p}`);
        dotenv.config({ path: p });
    }
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    console.log('Available env keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTemplates() {
    console.log(`Connecting to ${supabaseUrl}...`);
    const { data, error } = await supabase
        .from('bonus_templates')
        .select('*');

    if (error) {
        console.error('Error fetching templates:', error);
        return;
    }

    console.log(`Found ${data.length} templates:`);
    data.forEach(t => {
        console.log(`- ID: ${t.id}, Brand: ${t.brand_id}, Code: ${t.bonus_code}, Name: ${t.name}`);
    });
}

checkTemplates();
