const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/webhooks';
const API_KEY = process.env.EVOLUTION_API_KEY || 'test-key';

async function verifyEvolution() {
    console.log('\n--- Verifying Evolution Adapter ---');
    try {
        const debitResp = await axios.post(`${BASE_URL}/evolution/debit`, {
            userId: 'test-user-123',
            transactionId: 'evo-bet-001',
            amount: 5.0,
            gameId: 'roulette_live',
            operatorId: 'op_neostrike'
        }, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('Debit Response:', debitResp.data);

        const creditResp = await axios.post(`${BASE_URL}/evolution/credit`, {
            userId: 'test-user-123',
            transactionId: 'evo-win-001',
            amount: 15.0,
            gameId: 'roulette_live',
            operatorId: 'op_neostrike'
        }, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('Credit Response:', creditResp.data);
    } catch (err) {
        console.error('Evolution Verification Failed:', err.response?.data || err.message);
    }
}

async function verifyNetEnt() {
    console.log('\n--- Verifying NetEnt Adapter ---');
    try {
        const debitResp = await axios.post(`${BASE_URL}/netent/debit`, {
            userId: 'test-user-123',
            transactionId: 'netent-bet-001',
            amount: 1.0,
            gameId: 'starburst',
            operatorId: 'op_neostrike'
        }, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('Debit Response:', debitResp.data);

        const creditResp = await axios.post(`${BASE_URL}/netent/credit`, {
            userId: 'test-user-123',
            transactionId: 'netent-win-001',
            amount: 2.0,
            gameId: 'starburst',
            operatorId: 'op_neostrike'
        }, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('Credit Response:', creditResp.data);
    } catch (err) {
        console.error('NetEnt Verification Failed:', err.response?.data || err.message);
    }
}

async function verifyConfigService() {
    console.log('\n--- Verifying Provider Config Service ---');
    try {
        // Test fetching config for Evolution
        const evoConfigResp = await axios.get(`${BASE_URL}/config/evolution`, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('Evolution Config:', evoConfigResp.data);

        // Test fetching config for Pragmatic
        const pragConfigResp = await axios.get(`${BASE_URL}/config/pragmatic`, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('Pragmatic Config:', pragConfigResp.data);

        // Test fetching config for NetEnt
        const netentConfigResp = await axios.get(`${BASE_URL}/config/netent`, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('NetEnt Config:', netentConfigResp.data);

        // Test fetching non-existent config
        try {
            await axios.get(`${BASE_URL}/config/nonexistent`, {
                headers: { 'x-api-key': API_KEY }
            });
        } catch (err) {
            console.log('Non-existent Config Test (expected 404):', err.response?.status, err.response?.data);
        }

    } catch (err) {
        console.error('Config Service Verification Failed:', err.response?.data || err.message);
    }
}

async function verifyPragmatic() {
    console.log('\n--- Verifying Pragmatic Play Adapter ---');
    try {
        const debitResp = await axios.post(`${BASE_URL}/pragmatic/debit`, {
            userId: 'test-user-123',
            reference: 'prag-bet-001',
            amount: 2.5,
            gameId: 'wolf_gold',
            operatorId: 'op_neostrike',
            hash: 'mock-hash'
        }, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('Debit Response:', debitResp.data);

        const creditResp = await axios.post(`${BASE_URL}/pragmatic/credit`, {
            userId: 'test-user-123',
            reference: 'prag-win-001',
            amount: 5.0,
            gameId: 'wolf_gold',
            operatorId: 'op_neostrike',
            hash: 'mock-hash'
        }, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('Credit Response:', creditResp.data);
    } catch (err) {
        console.error('Pragmatic Verification Failed:', err.response?.data || err.message);
    }
}

// Set env vars for local test if not present
process.env.EVOLUTION_API_KEY = API_KEY;
process.env.PRAGMATIC_API_KEY = API_KEY;
process.env.NETENT_API_KEY = API_KEY; // Added NetEnt API Key

// Run verification
async function main() {
    // Note: Server must be running for this to work.
    // In this agentic environment, we will mock the WalletService for isolated verification.
    console.log('Starting Adapter Verification...');
    verifyEvolution();
    verifyPragmatic();
    verifyNetEnt(); // Added NetEnt verification
    verifyConfigService(); // Added Config Service verification
}

if (require.main === module) {
    main();
}
