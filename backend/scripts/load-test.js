const { Worker, isMainThread, workerData } = require('worker_threads');
const http = require('http');

/**
 * Load Test Script
 * Simulates high-concurrency traffic to the Wallet SPI.
 */

if (isMainThread) {
    const THREAD_COUNT = 4;
    const REQUESTS_PER_THREAD = 250;
    console.log(`\n--- Starting NeoStrike Load Test ---`);
    console.log(`Threads: ${THREAD_COUNT} | Total Requests: ${THREAD_COUNT * REQUESTS_PER_THREAD}`);

    const startTime = Date.now();
    let completed = 0;
    let successes = 0;

    for (let i = 0; i < THREAD_COUNT; i++) {
        const worker = new Worker(__filename, { workerData: { count: REQUESTS_PER_THREAD } });
        worker.on('message', (msg) => {
            successes += msg.successes;
            completed++;
            if (completed === THREAD_COUNT) {
                const duration = (Date.now() - startTime) / 1000;
                console.log(`\n--- Load Test Completed ---`);
                console.log(`Duration: ${duration.toFixed(2)}s`);
                console.log(`Throughput: ${(successes / duration).toFixed(2)} req/s`);
                console.log(`Success Rate: ${((successes / (THREAD_COUNT * REQUESTS_PER_THREAD)) * 100).toFixed(2)}%`);
                process.exit(0);
            }
        });
    }
} else {
    // Worker Thread Logic
    const makeRequest = () => {
        return new Promise((resolve) => {
            const options = {
                hostname: 'localhost',
                port: 5000,
                path: '/api/debit',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'sk_test_neostrike_2026',
                    'x-sandbox-mode': 'true' // Use sandbox to avoid DB overhead during load test
                }
            };

            const req = http.request(options, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => resolve(false));
            req.write(JSON.stringify({ user_id: 'test', amount: 1 }));
            req.end();
        });
    };

    (async () => {
        const { parentPort } = require('worker_threads');
        let successes = 0;
        for (let i = 0; i < workerData.count; i++) {
            if (await makeRequest()) successes++;
        }
        parentPort.postMessage({ successes });
    })();
}
