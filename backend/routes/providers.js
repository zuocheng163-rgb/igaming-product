const express = require('express');
const router = express.Router();
const WalletService = require('../services/wallet-service');
const EvolutionAdapter = require('../services/adapters/evolution');
const PragmaticPlayAdapter = require('../services/adapters/pragmatic');
const NetEntAdapter = require('../services/adapters/netent');

// Initialize adapters
const adapters = {
    evolution: new EvolutionAdapter({
        providerName: 'Evolution',
        apiKey: process.env.EVOLUTION_API_KEY
    }),
    pragmatic: new PragmaticPlayAdapter({
        providerName: 'PragmaticPlay',
        apiKey: process.env.PRAGMATIC_API_KEY
    }),
    netent: new NetEntAdapter({
        providerName: 'NetEnt',
        apiKey: process.env.NETENT_API_KEY
    })
};

/**
 * Common Webhook Handler
 */
const handleWebhook = async (req, res, adapterKey, type) => {
    const adapter = adapters[adapterKey];

    if (!adapter) {
        return res.status(404).json({ error: 'ADAPTER_NOT_FOUND' });
    }

    try {
        // 1. Verify Authentication
        if (!adapter.verifySignature(req)) {
            return res.status(401).json(adapter.formatError(new Error('INVALID_SIGNATURE')));
        }

        // 2. Transform Payload
        let result;
        const payload = req.body;
        const correlationId = req.headers['x-correlation-id'] || `${adapterKey}-${Date.now()}`;

        if (type === 'debit') {
            const standardizedDebit = adapter.transformDebit(payload);
            result = await WalletService.debit(
                standardizedDebit.userId,
                standardizedDebit.amount,
                standardizedDebit.transactionId,
                standardizedDebit.metadata.gameId,
                standardizedDebit.operatorId,
                correlationId
            );
        } else if (type === 'credit') {
            const standardizedCredit = adapter.transformCredit(payload);
            result = await WalletService.credit(
                standardizedCredit.userId,
                standardizedCredit.amount,
                standardizedCredit.transactionId,
                standardizedCredit.metadata.gameId,
                standardizedCredit.operatorId,
                correlationId
            );
        }

        // 3. Respond in Provider Format
        return res.status(200).json(adapter.formatResponse(result));

    } catch (error) {
        console.error(`[Webhook Error] ${adapterKey}:`, error);
        return res.status(200).json(adapter.formatError(error)); // Usually 200 with error body for providers
    }
};

// Evolution Gaming Routes
router.post('/evolution/debit', (req, res) => handleWebhook(req, res, 'evolution', 'debit'));
router.post('/evolution/credit', (req, res) => handleWebhook(req, res, 'evolution', 'credit'));

// Pragmatic Play Routes
router.post('/pragmatic/debit', (req, res) => handleWebhook(req, res, 'pragmatic', 'debit'));
router.post('/pragmatic/credit', (req, res) => handleWebhook(req, res, 'pragmatic', 'credit'));

// NetEnt Routes
router.post('/netent/debit', (req, res) => handleWebhook(req, res, 'netent', 'debit'));
router.post('/netent/credit', (req, res) => handleWebhook(req, res, 'netent', 'credit'));

module.exports = router;
