require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('--- Seeding Default Bonus Templates ---');

    const templates = [
        {
            name: 'Welcome Bonus 100%',
            bonus_code: 'WELCOME100',
            type: 'deposit_match',
            max_amount: 500.00,
            wagering_req: 35,
            min_deposit: 10.00,
            currency: 'EUR',
            active: true,
            brand_id: 1
        },
        {
            name: 'Weekend Reload',
            bonus_code: 'RELOAD50',
            type: 'reload',
            max_amount: 200.00,
            wagering_req: 30,
            min_deposit: 20.00,
            currency: 'EUR',
            active: true,
            brand_id: 1
        },
        {
            name: '10 Free Spins',
            bonus_code: 'FREESPIN10',
            type: 'free_spins',
            max_amount: 10.00,
            wagering_req: 1,
            min_deposit: 0.00,
            currency: 'EUR',
            active: true,
            brand_id: 1
        }
    ];

    for (const template of templates) {
        const { data, error } = await supabase
            .from('bonus_templates')
            .upsert(template, { onConflict: 'brand_id,bonus_code' })
            .select();

        if (error) {
            console.error(`Failed to seed ${template.bonus_code}:`, error.message);
        } else {
            console.log(`✅ Seeded: ${template.bonus_code}`);
        }
    }

    console.log('--- Seeding Complete ---');
    process.exit(0);
}

seed();
