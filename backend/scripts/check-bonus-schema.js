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

async function checkBonusTemplatesSchema() {
    console.log('Fetching columns for "bonus_templates"...');
    const { data, error } = await supabase
        .rpc('get_table_columns', { table_name_input: 'bonus_templates' });

    if (error) {
        // Fallback: search for any record and check its keys
        console.log('RPC failed, trying sample record fetch...');
        const { data: sample, error: sampleError } = await supabase
            .from('bonus_templates')
            .select('*')
            .limit(1);

        if (sampleError) {
            console.error('Error fetching sample record:', sampleError);
            return;
        }

        if (sample && sample.length > 0) {
            console.log('Sample record columns:', Object.keys(sample[0]));
        } else {
            console.log('No records found to inspect.');
        }
        return;
    }

    console.log('Bonus Templates Columns:', data);
}

// Helper to check if RPC exists, otherwise just fetch one record
async function run() {
    const { data: sample, error: sampleError } = await supabase
        .from('bonus_templates')
        .select('*')
        .limit(1);

    if (sampleError) {
        console.error('Error fetching sample record:', sampleError);
        return;
    }

    if (sample && sample.length > 0) {
        console.log('Sample record keys:', Object.keys(sample[0]));
        console.log('Sample record:', sample[0]);
    } else {
        // Table is empty, check columns via RPC if possible or just log
        console.log('Table is empty, trying to fetch columns via information_schema...');
        const { data: columns, error: colError } = await supabase.rpc('get_table_columns_v2', { t_name: 'bonus_templates' });
        if (colError) {
            console.error('Error fetching columns:', colError);
        } else {
            console.log('Columns:', columns);
        }
    }
}

run();
