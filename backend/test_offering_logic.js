require('dotenv').config();
const supabaseService = require('./services/supabase');

async function verifyLogic() {
    console.log('--- Verifying Backend Offering Logic ---');
    const brandId = 1;

    // 1. Test Env Priority (Env set to ADVANCED, DB set to basic)
    process.env.PRODUCT_OFFERING = 'ADVANCED';
    console.log('Step 1: Testing Env Priority (Env=ADVANCED, DB=basic)...');
    await supabaseService.client.from('tenant_configs').update({ product_tier: 'basic' }).eq('brand_id', String(brandId));
    
    config = await supabaseService.getTenantConfig(brandId);
    offering = (process.env.PRODUCT_OFFERING || config?.product_tier || 'BASIC').toUpperCase();
    console.log(`Env: ${process.env.PRODUCT_OFFERING}, Tier in DB: ${config.product_tier}, Resulting Offering: ${offering}`);
    if (offering !== 'ADVANCED') throw new Error('Environment variable did not take priority');

    // 2. Test Fallback (Env unset, DB set to advanced)
    const originalEnv = process.env.PRODUCT_OFFERING;
    delete process.env.PRODUCT_OFFERING;
    console.log('Step 2: Testing Fallback (Env=unset, DB=advanced)...');
    await supabaseService.client.from('tenant_configs').update({ product_tier: 'advanced' }).eq('brand_id', String(brandId));
    
    config = await supabaseService.getTenantConfig(brandId);
    offering = (process.env.PRODUCT_OFFERING || config?.product_tier || 'BASIC').toUpperCase();
    console.log(`Env: ${process.env.PRODUCT_OFFERING}, Tier in DB: ${config.product_tier}, Resulting Offering: ${offering}`);
    if (offering !== 'ADVANCED') throw new Error('Fallback to database failed');

    process.env.PRODUCT_OFFERING = originalEnv;
    console.log('✅ Logic Verified Successfully');
}

verifyLogic().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
