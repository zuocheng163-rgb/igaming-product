const WalletService = require('../services/wallet-service');
const supabaseService = require('../services/supabase');
const ftService = require('../services/ft-integration');
const socketService = require('../services/socket');
const { logger } = require('../services/logger');
require('dotenv').config();

// Mock Supabase
supabaseService.getUserById = async (id) => ({
    id,
    balance: 500,
    bonus_balance: 0,
    currency: 'EUR'
});
supabaseService.updateUser = async (id, data) => data;

// Mock FT and Socket
ftService.pushEvent = async (userId, event, data) => console.log(`[FT-MOCK] Pushed ${event} for ${userId}`);
socketService.broadcastToUser = (userId, event, data) => console.log(`[WS-MOCK] Broadcasted ${event} to ${userId}`, data);

// Mock Logger to see attempts
logger.info = (msg, data) => console.log(`[INFO] ${msg}`, data || '');
logger.warn = (msg, data) => console.log(`[WARN] ${msg}`, data || '');
logger.error = (msg, data) => console.log(`[ERROR] ${msg}`, data || '');

async function runTest() {
    console.log('🚀 Starting Sprint 1 Integration Test (Mocked DB)');

    const userId = 'user_demo_123';
    const operatorId = 'op_demo';
    const correlationId = 'test-' + Date.now();

    try {
        console.log('\n--- Test 1: Step-by-Step Payment Orchestration (Retry/Failover) ---');
        // We'll wrap the call to see the retries in the console
        const result = await WalletService.deposit(userId, 100, 'visa', operatorId, correlationId);
        console.log('\nFinal Deposit Result:', result);

        console.log('\n--- Test 2: Debit with Real-time Broadcast ---');
        const debitResult = await WalletService.debit(userId, 10, 'tx-123', 'game-456', operatorId, correlationId);
        console.log('Debit Result:', debitResult);

    } catch (err) {
        console.error('Test failed:', err.message);
    } finally {
        console.log('\nVerification script finished.');
        process.exit(0);
    }
}

runTest();
