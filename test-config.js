const axios = require('axios');
const token = 'token-admin-123456789';
const url = 'https://igaming-product.vercel.app/api/operator/config';

async function test() {
    try {
        const res = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-username': 'admin',
                'x-sandbox-mode': 'true'
            }
        });
        console.log('STATUS:', res.status);
        console.log('DATA:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('ERROR:', err.response ? err.response.status : err.message);
        if (err.response) console.log('ERROR DATA:', err.response.data);
    }
}
test();
