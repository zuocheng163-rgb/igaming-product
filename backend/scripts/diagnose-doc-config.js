const MonitoringService = require('../services/monitoring');
const { logger } = require('../services/logger');

async function testThresholds() {
    console.log("Testing Threshold Lookup...");

    // Mock brandId 1
    const thresholds = await MonitoringService.getThresholds(1);
    console.log("Thresholds found for Brand 1:", thresholds);

    if (thresholds.velocity === 20) {
        console.log("SUCCESS: Threshold is 20!");
    } else {
        console.log(`FAILURE: Threshold is ${thresholds.velocity} (expected 20)`);
    }
}

// In a real test, we would mock Supabase here, 
// but for a diagnostic script, we want to see what the REAL DB returns.
testThresholds().catch(err => console.error(err));
