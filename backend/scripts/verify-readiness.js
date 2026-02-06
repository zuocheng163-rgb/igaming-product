const http = require('http');

async function verifyReadiness() {
    console.log('\n--- Verifying Launch Readiness ---');

    console.log('1. Testing Sandbox Mode interception...');
    const sandboxResponse = await callApi('/api/userdetails/sbx_test', { 'x-sandbox-mode': 'true' });
    if (sandboxResponse.username && sandboxResponse.username.includes('sandbox')) {
        console.log('✅ Sandbox Mode VERIFIED');
    } else {
        console.log('❌ Sandbox Mode FAILED');
    }

    console.log('\n2. Testing Rate Limiting (Burst)...');
    let throttled = false;
    for (let i = 0; i < 30; i++) {
        const res = await fetchRaw('/api/authenticate');
        if (res.statusCode === 429) {
            throttled = true;
            break;
        }
    }

    if (throttled) {
        console.log('✅ Rate Limiting VERIFIED');
    } else {
        console.log('❌ Rate Limiting FAILED (Ensure server is running with express-rate-limit)');
    }
}

function callApi(path, headers = {}) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path,
            method: 'GET',
            headers: { 'x-api-key': 'sk_test_neostrike_2026', ...headers }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ text: data, statusCode: res.statusCode });
                }
            });
        });
        req.end();
    });
}

function fetchRaw(path) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path,
            method: 'POST'
        };
        const req = http.request(options, (res) => resolve(res));
        req.end();
    });
}

(async () => {
    try {
        await verifyReadiness();
        process.exit(0);
    } catch (e) {
        console.error('Verification failed', e);
        process.exit(1);
    }
})();
