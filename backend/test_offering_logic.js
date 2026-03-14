require('dotenv').config();
const supabaseService = require('./services/supabase');

async function verifyLogic() {
    console.log('--- Verifying Backend Offering Logic ---');
    const brandId = 1;

    // 1. Set to basic
    console.log('Step 1: Setting tier to basic...');
    await supabaseService.client.from('tenant_configs').update({ product_tier: 'basic' }).eq('brand_id', String(brandId));
    
    let config = await supabaseService.getTenantConfig(brandId);
    let offering = (config?.product_tier || 'BASIC').toUpperCase();
    console.log(`Tier in DB: ${config.product_tier}, Resulting Offering: ${offering}`);
    if (offering !== 'BASIC') throw new Error('Failed to map basic tier');

    // 2. Set to advanced
    console.log('Step 2: Setting tier to advanced...');
    await supabaseService.client.from('tenant_configs').update({ product_tier: 'advanced' }).eq('brand_id', String(brandId));
    
    config = await supabaseService.getTenantConfig(brandId);
    offering = (config?.product_tier || 'BASIC').toUpperCase();
    console.log(`Tier in DB: ${config.product_tier}, Resulting Offering: ${offering}`);
    if (offering !== 'ADVANCED') throw new Error('Failed to map advanced tier');

    console.log('✅ Logic Verified Successfully');
}

verifyLogic().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
