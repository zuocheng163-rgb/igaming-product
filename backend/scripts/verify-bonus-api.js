const http = require('http');

const PORT = 5000;
const ADMIN_TOKEN = 'token-verify-admin';
const PLAYER_TOKEN = 'token-test_player_1'; // This will create test_player_1 in DB via JIT

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: data ? JSON.parse(data) : null
                    });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', (e) => {
            console.error('Request Error:', e.message);
            reject(e);
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function verifyAPI() {
    console.log('--- Verifying Bonus API (Port 5000) ---');

    try {
        // 0. JIT Create Player by hitting an authenticated route
        console.log('\n0. JIT Creating test_player_1...');
        await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/bonus/list',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${PLAYER_TOKEN}` }
        });

        // 1. Verify /api/bonus/list
        console.log('\n1. Testing /api/bonus/list...');
        const listRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/bonus/list',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`
            }
        });
        console.log('Status:', listRes.status);
        if (listRes.data && listRes.data.Success) {
            console.log('Success Payload Format Verified: { Data, Success, Errors }');
            console.log('Count:', listRes.data.Data?.length);
            if (listRes.data.Data && listRes.data.Data.length > 0) {
                console.log('Mapping check (first item):');
                console.log('  text (Title):', listRes.data.Data[0].text);
                console.log('  value (Code):', listRes.data.Data[0].value);
            }
        } else {
            console.error('Failed /api/bonus/list:', JSON.stringify(listRes.data));
        }

        // 2. Verify /bonus/credit
        console.log('\n2. Testing /api/bonus/credit...');
        const creditRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/bonus/credit',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`,
                'Content-Type': 'application/json',
                'X-FastTrack-Id': 'test-ft-id-123',
                'X-FastTrack-ActivityId': 'act-123'
            }
        }, {
            user_id: 'test_player_1',
            bonus_code: 'WELCOME100',
            amount: 10
        });
        console.log('Status:', creditRes.status);
        console.log('Response:', JSON.stringify(creditRes.data));

        // 3. Verify /bonus/credit/funds
        console.log('\n3. Testing /api/bonus/credit/funds...');
        const fundsRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/bonus/credit/funds',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }, {
            user_id: 'test_player_1',
            bonus_code: 'WELCOME100', // Just testing existence
            amount: 10,
            reason: 'Test Fund Credit',
            currency: 'EUR'
        });
        console.log('Status:', fundsRes.status);
        console.log('Response:', JSON.stringify(fundsRes.data));

    } catch (error) {
        console.error('Verification script failed:', error.message);
    }
}

verifyAPI();



