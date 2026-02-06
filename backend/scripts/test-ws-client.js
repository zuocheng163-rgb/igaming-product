const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'neostrike-local-secret-key-123';
const TEST_USER_ID = 'user_demo_123';

const token = jwt.sign({ userId: TEST_USER_ID }, JWT_SECRET);
const socket = io('http://localhost:5000', {
    auth: { token }
});

socket.on('connect', () => {
    console.log('✅ Connected to NeoStrike WebSocket');
    console.log('--- Waiting for events ---');
});

socket.on('balance_update', (data) => {
    console.log('💰 [EVENT] balance_update received:', data);
});

socket.on('payment_status', (data) => {
    console.log('💳 [EVENT] payment_status received:', data);
    if (data.status === 'success') {
        console.log('🎉 Payment successful via', data.provider);
    } else {
        console.log('❌ Payment failed:', data.reason);
    }
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection Error:', err.message);
});

// Keep process alive for 30s
setTimeout(() => {
    console.log('Finished testing.');
    process.exit(0);
}, 30000);
