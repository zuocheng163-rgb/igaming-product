require('dotenv').config();
const { isFeatureEnabled } = require('./middleware/feature-gate');
const { logger } = require('./services/logger');

async function verify() {
    console.log('--- Verifying Feature Access for Brand 1 ---');
    
    const featuresToTest = ['BONUSING', 'GAMES', 'CRM', 'KYC'];
    
    for (const feature of featuresToTest) {
        const enabled = await isFeatureEnabled(feature, 1);
        console.log(`Feature [${feature}]: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    }
}

verify().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
