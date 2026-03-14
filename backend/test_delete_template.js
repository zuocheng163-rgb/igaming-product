require('dotenv').config();
const BonusManagementService = require('./services/bonus-management-service');

async function testDelete() {
    console.log('--- Testing Bonus Template Deletion (Service Level) ---');

    const brandId = 1;

    // 1. Create a dummy template to delete
    console.log('Step 1: Creating dummy template...');
    const template = await BonusManagementService.createTemplate(brandId, {
        name: 'DELETE_TEST_TEMPLATE',
        bonus_code: 'DELETE_ME',
        type: 'no_deposit',
        max_amount: 10,
        wagering_req: 1,
        currency: 'EUR',
        expiry_days: 1,
        active: true
    });

    console.log(`Template created with ID: ${template.id}`);

    // 2. Delete the template
    console.log('Step 2: Deleting template...');
    const result = await BonusManagementService.deleteTemplate(template.id);

    if (result.success) {
        console.log('✅ deleteTemplate service call succeeded');
    } else {
        console.error('❌ deleteTemplate service call failed');
        process.exit(1);
    }

    // 3. Verify it's gone
    console.log('Step 3: Verifying template is gone from DB...');
    const templates = await BonusManagementService.listTemplates(brandId);
    const stillExists = templates.some(t => t.id === template.id);

    if (!stillExists) {
        console.log('✅ Template is no longer in the DB');
    } else {
        console.error('❌ Template still exists in the DB');
        process.exit(1);
    }

    console.log('--- Verification Complete: SUCCESS ---');
}

testDelete().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
