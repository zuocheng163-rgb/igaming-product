/**
 * Migration: Create and seed bonus_config table
 * Run once: node backend/scripts/migrate-bonus-config.js
 */
require('../services/logger'); // ensure dotenv loaded
const supabaseService = require('../services/supabase');

async function run() {
    const client = supabaseService.client;
    if (!client) {
        console.error('❌ Supabase client not initialized. Check credentials.');
        process.exit(1);
    }

    // Create the table via raw SQL using rpc exec (if available)
    // Supabase JS client does not expose DDL directly, so we use the REST API approach.
    // We'll insert rows and let Supabase auto-create if using an Admin key,
    // OR we'll detect the error and print the DDL for manual execution.

    // First, check if table exists by trying a select
    const { error: checkError } = await client.from('bonus_config').select('id').limit(1);

    if (!checkError) {
        console.log('✅ bonus_config table already exists.');
        await seedData(client);
        return;
    }

    console.log('⚠️  bonus_config table does not exist.');
    console.log('');
    console.log('Please run the following SQL in your Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/cxjirfmrdzlcnywttjun/sql/new');
    console.log('');
    console.log(`-- ==========================================`);
    console.log(`-- Create and seed bonus_config table`);
    console.log(`-- ==========================================`);
    console.log(`CREATE TABLE IF NOT EXISTS public.bonus_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id integer NOT NULL DEFAULT 1,
  bonus_code text NOT NULL UNIQUE,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  bonus_type text NOT NULL DEFAULT 'DEPOSIT_MATCH',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bonus_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON public.bonus_config
  FOR SELECT USING (true);

INSERT INTO public.bonus_config (brand_id, bonus_code, name, amount, bonus_type, is_active) VALUES
  (1, 'WELCOME100', 'Welcome Bonus 100%', 100, 'DEPOSIT_MATCH', true),
  (1, 'RELOAD50',   'Weekend Reload',     50,  'RELOAD',        true),
  (1, 'FREESPIN10', '10 Free Spins',      10,  'FREE_SPINS',    true)
ON CONFLICT (bonus_code) DO NOTHING;`);
    console.log('');
    console.log('After running the SQL, the player portal bonus list will work.');
    process.exit(0);
}

async function seedData(client) {
    const bonuses = [
        { brand_id: 1, bonus_code: 'WELCOME100', name: 'Welcome Bonus 100%', amount: 100, currency: 'EUR', bonus_type: 'DEPOSIT_MATCH', is_active: true },
        { brand_id: 1, bonus_code: 'RELOAD50', name: 'Weekend Reload', amount: 50, currency: 'EUR', bonus_type: 'RELOAD', is_active: true },
        { brand_id: 1, bonus_code: 'FREESPIN10', name: '10 Free Spins', amount: 10, currency: 'EUR', bonus_type: 'FREE_SPINS', is_active: true },
    ];
    const { error } = await client.from('bonus_config').upsert(bonuses, { onConflict: 'bonus_code', ignoreDuplicates: true });
    if (error) {
        console.error('❌ Failed to seed bonuses:', error.message);
    } else {
        console.log('✅ Bonus data seeded successfully.');
    }
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
