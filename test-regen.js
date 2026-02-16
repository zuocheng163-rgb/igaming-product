const axios = require('axios');
const token = 'token-admin-123456789';
const url = 'https://igaming-product.vercel.app/api/operator/config/api-key';

async function test() {
    try {
        const newKey = 'sk_op_test_' + Math.random().toString(36).substring(7);
        console.log('REGENERATING with key:', newKey);
        const res = await axios.post(url, { api_key: newKey }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-username': 'admin',
                'x-sandbox-mode': 'true'
            }
        });
        console.log('STATUS:', res.status);
        console.log('DATA:', JSON.stringify(res.data, null, 2));

        // Now verify it via GET
        const configUrl = 'https://igaming-product.vercel.app/api/operator/config';
        const getRes = await axios.get(configUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-username': 'admin',
                'x-sandbox-mode': 'true'
            }
        });
        console.log('GET CONFIG DATA:', JSON.stringify(getRes.data, null, 2));
    } catch (err) {
        console.error('ERROR:', err.response ? err.response.status : err.message);
        if (err.response) console.log('ERROR DATA:', err.response.data);
    }
}
test();
