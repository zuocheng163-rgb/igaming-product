const MonitoringService = require('../services/monitoring');
const InterventionService = require('../services/intervention');
const supabaseService = require('../services/supabase');
const ftService = require('../services/ft-integration');
const socketService = require('../services/socket');
const { logger } = require('../services/logger');

// Global state for capture
let capturedEvents = [];

// 1. Mock Socket.io BEFORE requiring WalletService
socketService.broadcastToUser = (userId, event, data) => {
    console.log(`[Captured WS] ${event}`, data);
    capturedEvents.push({ type: 'ws', event, data });
};

// 2. Mock Fast Track
ftService.pushEvent = (userId, type, payload) => {
    console.log(`[Captured FT] ${type}`, payload);
    capturedEvents.push({ type: 'ft', event: type, data: payload });
};

// 3. Mock Supabase
supabaseService.getUserById = async (id) => ({
    id,
    balance: 1000,
    bonus_balance: 100,
    currency: 'EUR'
});
supabaseService.updateUser = async (id, data) => ({ id, ...data });

let mockTxCount = 0;
supabaseService.client = {
    from: () => ({
        select: () => ({
            eq: () => ({
                eq: () => ({
                    gte: () => Promise.resolve({ count: mockTxCount, error: null }),
                    order: () => Promise.resolve({ data: [], error: null })
                }),
                gte: () => ({
                    order: () => Promise.resolve({ data: new Array(mockTxCount).fill({ action: 'wallet:deposit' }), error: null })
                })
            })
        })
    })
};

// 4. Now require WalletService
const WalletService = require('../services/wallet-service');

// Mock payment orchestration to avoid retries
WalletService._orchestrateExternalPayment = async () => ({ status: 'Approved', provider: 'Mock' });

async function testInterventions() {
    console.log('\n--- Running AI Duty of Care Verification ---');

    // Test Case 1: Velocity Spike (12 bets in a minute)
    console.log('\nTesting Velocity Spike...');
    mockTxCount = 12;
    capturedEvents = [];

    await WalletService.debit('user_123', 10, 'tx_v1', 'game_1', 'op_1', 'corr_v1');

    const hasRealityCheck = capturedEvents.some(e => e.type === 'ws' && e.event === 'rg_alert');
    const hasFTFlag = capturedEvents.some(e => e.type === 'ft' && e.event === 'risk_flag');

    if (hasRealityCheck && hasFTFlag) {
        console.log('✅ Velocity Spike Interventions VERIFIED');
    } else {
        console.log('❌ Velocity Spike Interventions FAILED');
        console.log('Captured:', capturedEvents);
    }

    // Test Case 2: Chasing Losses (Multiple deposits)
    console.log('\nTesting Chasing Losses...');
    mockTxCount = 6;
    capturedEvents = [];

    await WalletService.deposit('user_123', 100, 'Adyen', 'op_1', 'corr_d1');

    const hasHighRiskFlag = capturedEvents.some(e => e.type === 'ft' && e.event === 'risk_flag' && e.data.risk_level === 'HIGH');

    if (hasHighRiskFlag) {
        console.log('✅ Chasing Losses Risk Flag VERIFIED');
    } else {
        console.log('❌ Chasing Losses Risk Flag FAILED');
    }
}

testInterventions();
