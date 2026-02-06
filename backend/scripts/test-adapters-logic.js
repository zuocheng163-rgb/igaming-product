const EvolutionAdapter = require('../services/adapters/evolution');
const PragmaticPlayAdapter = require('../services/adapters/pragmatic');
const NetEntAdapter = require('../services/adapters/netent');
const assert = require('assert');

function testEvolution() {
    console.log('Testing EvolutionAdapter...');
    const adapter = new EvolutionAdapter({ apiKey: 'secret' });

    // Test Debit Transformation
    const debitPayload = {
        userId: 'player_1',
        transactionId: 'tx_123',
        amount: 10,
        gameId: 'baccarat_live',
        operatorId: 'op_1'
    };
    const debit = adapter.transformDebit(debitPayload);
    assert.strictEqual(debit.userId, 'player_1');
    assert.strictEqual(debit.amount, 10);
    assert.strictEqual(debit.metadata.provider, 'Evolution');
    assert.strictEqual(debit.metadata.gameId, 'baccarat_live');

    // Test Response Formatting
    const mockResult = { balance: 100, bonus_balance: 5, transaction_id: 'tx_123' };
    const resp = adapter.formatResponse(mockResult);
    assert.strictEqual(resp.status, 'OK');
    assert.strictEqual(resp.balance, 100);

    console.log('✅ EvolutionAdapter tests passed');
}

function testPragmatic() {
    console.log('Testing PragmaticPlayAdapter...');
    const adapter = new PragmaticPlayAdapter({ apiKey: 'secret' });

    // Test Debit Transformation
    const debitPayload = {
        userId: 'player_2',
        reference: 'prag_ref_456',
        amount: 2.5,
        gameId: 'fruit_slots',
        operatorId: 'op_1'
    };
    const debit = adapter.transformDebit(debitPayload);
    assert.strictEqual(debit.userId, 'player_2');
    assert.strictEqual(debit.transactionId, 'prag_ref_456');
    assert.strictEqual(debit.metadata.provider, 'PragmaticPlay');

    // Test Error Formatting
    const error = new Error('INSUFFICIENT_FUNDS');
    const errResp = adapter.formatError(error);
    assert.strictEqual(errResp.error, 100);

    console.log('✅ PragmaticPlayAdapter tests passed');
}

function testNetEnt() {
    console.log('Testing NetEntAdapter...');
    const adapter = new NetEntAdapter({ apiKey: 'secret' });

    // Test Debit Transformation
    const debitPayload = {
        playerId: 'player_3',
        transactionId: 'net_tx_789',
        amount: 50,
        gameName: 'gonzos_quest',
        operatorId: 'op_1'
    };
    const debit = adapter.transformDebit(debitPayload);
    assert.strictEqual(debit.userId, 'player_3');
    assert.strictEqual(debit.metadata.provider, 'NetEnt');

    // Test Response Formatting
    const mockResult = { balance: 500, transaction_id: 'net_tx_789', currency: 'USD' };
    const resp = adapter.formatResponse(mockResult);
    assert.strictEqual(resp.status, 'SUCCESS');
    assert.strictEqual(resp.balance, 500);

    console.log('✅ NetEntAdapter tests passed');
}

try {
    testEvolution();
    testPragmatic();
    testNetEnt();
    console.log('\nAll Adapter Unit Tests Passed! 🚀');
} catch (err) {
    console.error('\n❌ Unit Test Failed:');
    console.error(err);
    process.exit(1);
}
