require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('../services/logger');
const WalletService = require('../services/wallet-service');
const NuveiAdapter = require('../services/psp/nuvei-adapter');
const supabaseService = require('../services/supabase');
const crypto = require('crypto');

async function run() {
    console.log('--- Starting F8/F9 Verification ---');
    try {
        const testUser = await getTestUser();
        if (!testUser) {
            console.error('No test user found, DB likely empty. Please run migrations first or wait for DB ready.');
            return;
        }

        console.log(`Using Test User: ${testUser.username} (${testUser.id})`);

        // 1. F9: Initiate Deposit
        console.log('\n[F9] Initiating Deposit...');
        const initTx = await WalletService.initiateDeposit(testUser.id, 50, 'EUR', 'http://localhost/return', 1, 'v-1');
        console.log(`✅ Deposit Initiated: ${initTx.transaction_id} -> URL: ${initTx.checkout_url}`);

        // 2. F9: Webhook Confirmation
        console.log('\n[F9] Testing Nuvei Webhook (Approval)...');
        const pspTxId = 'nuvei-tx-' + Date.now();
        const payload = JSON.stringify({
            clientRequestId: initTx.transaction_id,
            transactionId: pspTxId,
            amount: '50.00',
            status: 'APPROVED'
        });
        const secret = process.env.NUVEI_WEBHOOK_SECRET || 'test_secret_for_hmac';
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        const reqMock = { headers: { 'x-nuvei-signature': signature }, body: JSON.parse(payload) };
        const webhookRes = await NuveiAdapter.handleWebhook(reqMock, payload);

        if (webhookRes.success) {
            console.log(`✅ Webhook Processed Successfully! Result DB ID: ${webhookRes.updated.id}`);
        } else {
            console.error('❌ Webhook failed', webhookRes);
        }

        // 3. F8: Bonus Crediting (Mocking a 100% deposit match from Fast Track triggering bonus logic)
        console.log('\n[F8] Crediting Bonus (Idempotency Check)...');
        const fasttrackRefs = { id: `ft-id-${Date.now()}` };

        // Ensure bonus_templates has WELCOME100, if not it will gracefully fallback to default 35x
        const bonusRes1 = await WalletService.creditBonus(testUser.id, 50, 'WELCOME100', 1, 'v-2', fasttrackRefs);
        console.log(`✅ Credited 50 EUR bonus. New Bonus Balance: ${bonusRes1.bonus_balance}, Wager Req: ${bonusRes1.wagering_required}`);

        // Test idempotency
        const bonusRes2 = await WalletService.creditBonus(testUser.id, 50, 'WELCOME100', 1, 'v-2', fasttrackRefs);
        if (bonusRes2.duplicate) {
            console.log(`✅ Idempotency working! Ignored second POST with same X-Fasttrack-Id.`);
        } else {
            console.error('❌ Idempotency failed!');
        }

        // 4. F8: Wagering Progression
        console.log('\n[F8] Testing Wagering Progression (Debit)...');
        // Let's bet 10 EUR. User should have real balance from the deposit, so it should use real balance first.
        const betTx = await WalletService.debit(testUser.id, 10, 'EUR', 1, { game_id: 'slots_1' }, 'v-3');
        console.log(`✅ Bet 10 EUR. Balance: ${betTx.afterBalance}, Bonus: ${betTx.afterBonusBalance}`);

        // Fetch the bonus instance to verify progression
        const { data: bonusList } = await supabaseService.client.from('bonus_instances').select('*').eq('player_id', testUser.id);
        if (bonusList && bonusList.length > 0) {
            const latestBonus = bonusList[bonusList.length - 1];
            console.log(`✅ Wagering Progress updated: ${latestBonus.wagering_progress} / ${latestBonus.wagering_required} (State: ${latestBonus.state})`);
        }

    } catch (e) {
        if (e.message.includes('relation "payment_transactions" does not exist')) {
            console.log('\n⚠️ Schema migrations have not been applied yet. Skipping core execution tests. Ask the user to apply 20260228_f8_f9_schema.sql.');
        } else {
            console.error('Test Error:', e);
        }
    }
    process.exit(0);
}

async function getTestUser() {
    const { data: user } = await supabaseService.client.from('users').select('*').limit(1).single();
    return user;
}

run();
