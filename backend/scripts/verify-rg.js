const WalletService = require('../services/wallet-service');
const supabaseService = require('../services/supabase');
const ftService = require('../services/ft-integration');
const socketService = require('../services/socket');
const { logger } = require('../services/logger');

// MOCKING
jest = { mock: (obj, method, fn) => { obj[method] = fn; } };

// Mock Supabase
supabaseService.getUserById = async (id) => ({
    id,
    balance: 1000,
    bonus_balance: 100,
    currency: 'EUR'
});
supabaseService.updateUser = async (id, data) => ({ id, ...data });

// Mock audit logs to simulate high velocity
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

// Mock Socket
let lastSocketEvent = null;
socketService.broadcastToUser = (userId, event, data) => {
    console.log(`[Mock WS] Broadcast to ${userId}: ${event}`, data);
    lastSocketEvent = { event, data };
};

// Mock FT
let lastFTEvent = null;
ftService.pushEvent = (userId, type, payload) => {
    console.log(`[Mock FT] Push Event for ${userId}: ${type}`, payload);
    lastFTEvent = { type, payload };
};

// Mock Logger
logger.info = console.log;
logger.warn = console.warn;
logger.error = console.error;

async function testVelocityIntervention() {
    console.log('\n--- Testing Velocity Spike Intervention ---');
    mockTxCount = 12; // Trigger threshold is 10

    await WalletService.debit('user_123', 10, 'tx_001', 'game_001', 'op_1', 'corr_1');

    if (lastSocketEvent && lastSocketEvent.event === 'rg_alert' && lastSocketEvent.data.type === 'REALITY_CHECK') {
        console.log('✅ Velocity Spike Reality Check Triggered');
    } else {
        console.log('❌ Velocity Spike Reality Check FAILED');
    }
}

async function testChasingLossesIntervention() {
    console.log('\n--- Testing Chasing Losses Intervention ---');
    mockTxCount = 6; // Trigger threshold is 5 deposits

    // Simulate deposit
    await WalletService.deposit('user_123', 100, 'Adyen', 'op_1', 'corr_2');

    if (lastFTEvent && lastFTEvent.type === 'risk_flag' && lastFTEvent.payload.risk_level === 'HIGH') {
        console.log('✅ Chasing Losses Risk Flag sent to CRM');
    } else {
        console.log('❌ Chasing Losses Risk Flag FAILED');
    }
}

async function run() {
    try {
        await testVelocityIntervention();
        await testChasingLossesIntervention();
    } catch (err) {
        console.error('Verification failed:', err);
    }
}

run();
