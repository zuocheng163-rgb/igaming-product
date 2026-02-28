const axios = require('axios');
const { logger } = require('../services/logger');

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:5000/api/webhooks/kyc/sumsub';

async function verifyF10() {
    console.log('--- F10 KYC Flow Verification ---');

    const brandId = 1;
    const testUsername = `user_${Date.now()}`;
    const testEmail = `${testUsername}@example.com`;

    try {
        // 1. Register Player
        console.log(`[1] Registering player: ${testUsername}...`);
        const regRes = await axios.post(`${API_BASE_URL}/register`, {
            username: testUsername,
            email: testEmail,
            brand_id: brandId,
            first_name: 'Test',
            last_name: 'User'
        });
        const userId = regRes.data.user.id;
        const playerSid = regRes.data.user.username;
        const token = regRes.data.token;
        console.log(`    Success. User ID: ${userId}, Token: ${token}`);

        // 1.5. Credit Balance (Required for Debit test)
        console.log(`[1.5] Crediting balance for ${userId}...`);
        await axios.post(`${API_BASE_URL}/v1/demo/credit`, {
            userId: userId,
            amount: 100
        });

        // 2. Initiate KYC
        console.log(`[2] Initiating KYC for ${userId}...`);
        const initRes = await axios.post(`${API_BASE_URL}/v1/kyc/initiate`, {
            userId: userId
        }, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-username': testUsername }
        });
        console.log(`    Success. Token: ${initRes.data.sumsub_token}`);

        // 3. Check Status (Should be NOT_STARTED or PENDING)
        console.log(`[3] Checking KYC status...`);
        const statusRes = await axios.get(`${API_BASE_URL}/v1/kyc/status`, {
            params: { userId: userId },
            headers: { 'Authorization': `Bearer ${token}`, 'x-username': testUsername }
        });
        console.log(`    Current Status: ${statusRes.data.kyc_status}`);

        // 4. Simulate REJECTED (FINAL) Webhook -> Expect Wallet Blocked
        console.log(`[4] Simulating FINAL REJECTION webhook...`);
        await axios.post(WEBHOOK_URL, {
            type: 'applicantReviewed',
            applicantId: 'app_12345',
            externalUserId: userId,
            reviewResult: {
                reviewAnswer: 'RED',
                rejectType: 'FINAL'
            }
        }, {
            headers: { 'x-payload-digest': 'dummy_signature' }
        });

        // 5. Verify Wallet Blocked via Debit Call
        console.log(`[5] Verifying wallet gating (DEBIT)...`);
        try {
            const debitFailRes = await axios.post(`${API_BASE_URL}/debit`, {
                user_id: playerSid,
                amount: 10,
                transaction_id: `tx_${Date.now()}`,
                game_id: 'test_game_1'
            }, {
                headers: { 'Authorization': `Bearer ${token}`, 'x-username': testUsername }
            });
            console.error('    FAIL: Debit should have been blocked!', debitFailRes.data);
        } catch (err) {
            if (err.response?.data?.error === 'PLAYER_BLOCKED') {
                console.log('    Success: Debit blocked as expected.');
            } else {
                console.error(`    FAIL: Expected PLAYER_BLOCKED, got: ${err.response?.data?.error || err.message}`);
            }
        }

        // 6. Simulate VERIFIED Webhook -> Expect Wallet Unblocked
        console.log(`[6] Simulating VERIFIED webhook...`);
        await axios.post(WEBHOOK_URL, {
            type: 'applicantReviewed',
            applicantId: 'app_12345',
            externalUserId: userId,
            reviewResult: {
                reviewAnswer: 'GREEN'
            }
        }, {
            headers: { 'x-payload-digest': 'dummy_signature' }
        });

        // 7. Verify Status & Wallet Unblocked
        console.log(`[7] Verifying final status...`);
        const finalStatus = await axios.get(`${API_BASE_URL}/v1/kyc/status`, {
            params: { userId: userId },
            headers: { 'Authorization': `Bearer ${token}`, 'x-username': testUsername }
        });
        console.log(`    Final KYC Status: ${finalStatus.data.kyc_status}`);

        console.log(`[8] Verifying wallet access (DEBIT)...`);
        const debitRes = await axios.post(`${API_BASE_URL}/debit`, {
            user_id: playerSid,
            amount: 1,
            transaction_id: `tx_final_${Date.now()}`,
            game_id: 'test_game_1'
        }, {
            headers: { 'Authorization': `Bearer ${token}`, 'x-username': testUsername }
        });
        console.log(`    Success: Debit allowed after verification. Balance: ${debitRes.data.balance}`);

        console.log('\n--- F10 Verification COMPLETED SUCCESSFULLY ---');
    } catch (error) {
        console.error('Verification FAILED:', error.response?.data || error.message);
        process.exit(1);
    }
}

verifyF10();
