const MonitoringService = require('../services/monitoring');
const InterventionService = require('../services/intervention');
const WalletService = require('../services/wallet-service');
const supabaseService = require('../services/supabase');
const ftService = require('../services/ft-integration');
// socketService removed, using rabbitmq or direct array for checks

async function verifyAffordabilityFlow() {
    console.log('\n--- Verifying Affordability Flow ---');

    const userId = 'user_afford_123';
    let capturedWS = [];

    // 1. Mocks
    const rabbitmq = require('../services/rabbitmq');
    rabbitmq.publishEvent = async (routingKey, message) => {
        console.log(`[Captured Event] ${routingKey}`, message);
        capturedWS.push({ event: 'rg_alert', data: message });
        return true;
    };

    ftService.pushEvent = async () => { }; // No-op for check

    // Simplified Mock Supabase
    const mockClient = {
        from: () => mockClient,
        select: () => mockClient,
        eq: () => mockClient,
        gte: () => mockClient,
        order: () => mockClient,
        then: (onFullfilled) => {
            // Check if it's the affordability check (sum of amounts)
            return Promise.resolve({
                data: [
                    { metadata: { amount: 500 }, action: 'wallet:deposit' },
                    { metadata: { amount: 700 }, action: 'wallet:deposit' }
                ],
                count: 0,
                error: null
            }).then(onFullfilled);
        }
    };
    supabaseService.client = mockClient;

    // 2. Trigger Evaluation
    console.log('Evaluating risk for user with > €1,000 deposits...');
    const risk = await MonitoringService.evaluateRisk(userId);

    if (risk && risk.reasons.includes('isAffordabilityThresholdReached')) {
        console.log('✅ MonitoringService detected affordability threshold');
    } else {
        console.log('❌ MonitoringService FAILED to detect threshold');
    }

    // 3. Trigger Intervention
    console.log('Triggering intervention logic...');
    await InterventionService.handleRiskDetected(userId, risk);

    const hasAffordPopup = capturedWS.some(w => w.event === 'rg_alert' && w.data.type === 'AFFORDABILITY_CHECK');

    if (hasAffordPopup) {
        console.log('✅ InterventionService triggered AFFORDABILITY_CHECK popup');
    } else {
        console.log('❌ InterventionService FAILED to trigger popup');
    }
}

async function verifyFTWebhook() {
    console.log('\n--- Verifying Fast Track Webhook ---');
    const { app } = require('../server');
    const request = require('supertest');

    const res = await request(app)
        .post('/api/webhooks/fasttrack')
        .send({
            user_id: 'user_webhook_123',
            action: 'LOCK_PLAYER',
            operator_id: 'op_1'
        });

    if (res.status === 200 && res.body.success) {
        console.log('✅ FT Webhook Endpoint VERIFIED');
    } else {
        console.log('❌ FT Webhook Endpoint FAILED', res.body);
    }
}

// Run sequentially
(async () => {
    await verifyAffordabilityFlow();
    // verifyFTWebhook needs supertest and a running app, skip for now or use simplified mock
    console.log('\nVerification Complete.');
    process.exit(0);
})();
