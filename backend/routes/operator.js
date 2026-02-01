const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const ftService = require('../services/ft-integration');
const { logger, auditLog, generateCorrelationId } = require('../services/logger');

// Middleware to extract or generate Correlation ID
const correlationMiddleware = (req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
    res.setHeader('X-Correlation-ID', req.correlationId);
    next();
};

router.use(correlationMiddleware);

// Middleware to authenticate user or operator
const authenticateRequest = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const sessionToken = req.headers['authorization']?.startsWith('Bearer ')
        ? req.headers['authorization'].slice(7)
        : req.headers['authorization'];
    const username = req.headers['x-username'] || req.body?.username;

    // 1. S2S Authentication (API Key)
    if (apiKey && apiKey === process.env.OPERATOR_API_KEY) {
        req.isOperator = true;
        return next();
    }

    // 2. User Authentication (Session Token)
    if (sessionToken) {
        const user = await supabaseService.getUser(username, sessionToken);
        if (user) {
            req.user = user;
            req.operatorId = user.operator_id || 'default';
            return next();
        }
    }

    logger.warn('Unauthorized access attempt', {
        path: req.path,
        correlationId: req.correlationId
    });
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key or Token' });
};

// --- ENDPOINTS ---

router.post('/authenticate', authenticateRequest, async (req, res) => {
    const { correlationId, user } = req;
    const operatorId = user.operator_id || 'default';

    try {
        const sessionId = `sid-${user.id}-${Date.now()}`;

        await ftService.pushEvent(user.id, 'login', {
            session_id: sessionId,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        }, { correlationId, operatorId });

        await ftService.pushEvent(user.id, 'balance', {
            amount: user.balance,
            bonus_amount: user.bonus_balance || 0,
            currency: user.currency
        }, { correlationId, operatorId });

        res.json({
            sid: sessionId,
            user_id: user.id,
            currency: user.currency,
            operator_id: operatorId,
            user: {
                id: user.id,
                user_id: user.id,
                username: user.username,
                balance: user.balance,
                bonus_balance: user.bonus_balance,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email
            }
        });
    } catch (error) {
        logger.error('Authentication failure', { correlationId, error: error.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/balance', authenticateRequest, async (req, res) => {
    res.json({
        amount: req.user.balance,
        bonus_amount: req.user.bonus_balance || 0,
        currency: req.user.currency
    });
});

const WalletService = require('../services/wallet-service');

router.post('/debit', authenticateRequest, async (req, res) => {
    const { correlationId } = req;
    const { user_id, amount, transaction_id, game_id, operator_id } = req.body;
    const currentOperatorId = operator_id || req.user?.operator_id || 'default';

    if (!user_id || amount === undefined) {
        return res.status(400).json({ error: 'Missing user_id or amount' });
    }

    try {
        const result = await WalletService.debit(
            user_id, amount, transaction_id, game_id,
            currentOperatorId, correlationId
        );
        res.json(result);
    } catch (error) {
        const status = error.message === 'INSUFFICIENT_FUNDS' ? 402 : 500;
        res.status(status).json({ error: error.message });
    }
});

router.post('/credit', authenticateRequest, async (req, res) => {
    const { correlationId } = req;
    const { user_id, amount, transaction_id, game_id, operator_id } = req.body;
    const currentOperatorId = operator_id || req.user?.operator_id || 'default';

    if (!user_id || amount === undefined) {
        return res.status(400).json({ error: 'Missing user_id or amount' });
    }

    try {
        const result = await WalletService.credit(
            user_id, amount, transaction_id, game_id,
            currentOperatorId, correlationId
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User Onboarding & Updates
router.post('/register', async (req, res) => {
    const { correlationId } = req;
    const { username, email, first_name, last_name, operator_id } = req.body;
    const currentOperatorId = operator_id || 'default';

    if (!username || !email) return res.status(400).json({ error: 'Missing required fields' });

    try {
        const token = `token-${username}-${Date.now()}`;
        const newUser = await supabaseService.createUser({
            username, email, first_name, last_name,
            token, operator_id: currentOperatorId
        });

        await ftService.pushEvent(newUser.id, 'registration', {
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        }, { correlationId, operatorId: currentOperatorId });

        res.json({
            user_id: newUser.id,
            token,
            user: { ...newUser, user_id: newUser.id }
        });
    } catch (error) {
        logger.error('Registration failed', { correlationId, error: error.message });
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/user/update', authenticateRequest, async (req, res) => {
    const { correlationId, user } = req;
    try {
        const updatedUser = await supabaseService.updateUser(user.id, req.body);

        await ftService.pushEvent(user.id, 'user_update', {
            ...req.body
        }, { correlationId, operatorId: user.operator_id });

        res.json({ user: { ...updatedUser, user_id: updatedUser.id } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// FT Simulation Endpoints (Consents, Blocks, etc.)
router.put('/userconsents/:userid', authenticateRequest, async (req, res) => {
    const { correlationId } = req;
    const { consents } = req.body;
    const userId = req.params.userid;

    try {
        const user = await supabaseService.getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        await ftService.pushEvent(user.id, 'consent', {
            consents
        }, { correlationId, operatorId: user.operator_id });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/userblocks/:userid', authenticateRequest, async (req, res) => {
    const { correlationId } = req;
    const { blocks } = req.body;
    const userId = req.params.userid;

    try {
        const user = await supabaseService.getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        await ftService.pushEvent(user.id, 'block', {
            blocks
        }, { correlationId, operatorId: user.operator_id });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/registration', authenticateRequest, async (req, res) => {
    const { correlationId, user } = req;
    try {
        await ftService.pushEvent(user.id, 'registration', {
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        }, { correlationId, operatorId: user.operator_id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/logout', authenticateRequest, async (req, res) => {
    const { correlationId, user } = req;
    try {
        await ftService.pushEvent(user.id, 'logout', {}, { correlationId, operatorId: user.operator_id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User Details (Used by FT)
router.get('/userdetails/:userid', authenticateRequest, async (req, res) => {
    const { correlationId } = req;
    const user = await supabaseService.getUserById(req.params.userid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const response = {
        user_id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        currency: user.currency || 'EUR',
        country: user.country || 'MT',
        operator_id: user.operator_id
    };

    await auditLog({
        correlationId,
        operatorId: user.operator_id,
        action: 'inbound:userdetails',
        entity_type: 'user',
        entity_id: user.id,
        metadata: { response },
        message: 'Shared user details with FT'
    });

    res.json(response);
});

module.exports = router;
