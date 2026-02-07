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
// Middleware to authenticate user or operator
const authenticateRequest = async (req, res, next) => {
    const correlationId = req.correlationId;
    try {
        const apiKey = req.headers['x-api-key'];
        const sessionToken = req.headers['authorization']?.startsWith('Bearer ')
            ? req.headers['authorization'].slice(7)
            : req.headers['authorization'];
        const username = req.headers['x-username'] || req.body?.username;

        // 1. S2S Authentication (API Key)
        if (apiKey && apiKey === process.env.OPERATOR_API_KEY) {
            req.isOperator = true;
            req.role = 'ADMIN'; // S2S is always Admin in PoC
            return next();
        }

        // 2. User Authentication (Session Token)
        if (sessionToken) {
            const user = await supabaseService.getUser(username, sessionToken);
            if (user) {
                req.user = user;
                req.brandId = user.brand_id || 1;
                req.role = user.role || 'SUPPORT'; // Default to Support if not specified
                return next();
            }
        }

        logger.warn('Unauthorized access attempt', {
            path: req.path,
            correlationId
        });
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key or Token' });
    } catch (error) {
        logger.error('Authentication Middleware Error', { correlationId, error: error.message });
        return res.status(500).json({ error: 'Internal Server Error during Authentication' });
    }
};

/**
 * RBAC Helper Middleware
 */
const requireAdmin = (req, res, next) => {
    if (req.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
};

// --- ENDPOINTS ---

router.post('/authenticate', async (req, res) => {
    const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
    try {
        const { username } = req.body;
        const sessionToken = req.headers['authorization']?.startsWith('Bearer ')
            ? req.headers['authorization'].slice(7)
            : req.headers['authorization'];

        const user = await supabaseService.getUser(username, sessionToken);

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid API Token or Username' });
        }

        const brandId = user.brand_id || 1;
        const sessionId = `sid-${user.id}-${Date.now()}`;

        await ftService.pushEvent(user.user_id, 'login', {
            session_id: sessionId,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        }, { correlationId, brandId });

        await ftService.pushEvent(user.user_id, 'balance', {
            amount: user.balance,
            bonus_amount: user.bonus_balance || 0,
            currency: user.currency
        }, { correlationId, brandId });

        res.json({
            sid: sessionId,
            user_id: user.user_id,
            currency: user.currency,
            brand_id: brandId,
            user: {
                id: user.id,
                user_id: user.user_id,
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
        const errorMessage = typeof error === 'string' ? error : (error.message || 'Debit failed');
        res.status(status).json({ error: errorMessage });
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
        const errorMessage = typeof error === 'string' ? error : (error.message || 'Error occurred');
        res.status(500).json({ error: errorMessage });
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

        await ftService.pushEvent(newUser.username, 'registration', {
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        }, { correlationId, operatorId: currentOperatorId });

        if (!newUser) {
            throw new Error('User creation succeeded but no data was returned');
        }

        res.json({
            user_id: newUser.username,
            token,
            user: { ...newUser, user_id: newUser.username }
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

        await ftService.pushEvent(user.user_id, 'user_update', {
            ...req.body
        }, { correlationId, brandId: user.brand_id });

        res.json({ user: { ...updatedUser, user_id: updatedUser.username } });
    } catch (error) {
        const errorMessage = typeof error === 'string' ? error : (error.message || 'Error occurred');
        res.status(500).json({ error: errorMessage });
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

        await auditLog({
            correlationId,
            operatorId: user.operator_id,
            actor_id: user.id,
            action: 'inbound:update_consent',
            entity_type: 'user',
            entity_id: user.id,
            status: 'success',
            metadata: { request: { consents } },
            message: `User ${user.id} updated consents via simulation`
        });

        await ftService.pushEvent(user.user_id, 'consent', {
            consents
        }, { correlationId, brandId: user.brand_id });

        res.json({ success: true });
    } catch (error) {
        const errorMessage = typeof error === 'string' ? error : (error.message || 'Error occurred');
        res.status(500).json({ error: errorMessage });
    }
});

router.put('/userblocks/:userid', authenticateRequest, async (req, res) => {
    const { correlationId } = req;
    const { blocks } = req.body;
    const userId = req.params.userid;

    try {
        const user = await supabaseService.getUserById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        await auditLog({
            correlationId,
            operatorId: user.operator_id,
            actor_id: user.id,
            action: 'inbound:update_block',
            entity_type: 'user',
            entity_id: user.id,
            status: 'success',
            metadata: { request: { blocks } },
            message: `User ${user.id} updated blocks via simulation`
        });

        await ftService.pushEvent(user.user_id, 'block', {
            blocks
        }, { correlationId, brandId: user.brand_id });

        res.json({ success: true });
    } catch (error) {
        const errorMessage = typeof error === 'string' ? error : (error.message || 'Error occurred');
        res.status(500).json({ error: errorMessage });
    }
});

router.get('/userconsents/:userid', authenticateRequest, async (req, res) => {
    const { correlationId } = req;
    try {
        const data = await supabaseService.getUserConsents(req.params.userid);

        // Transform the DB record into the FT-required array structure
        const response = [
            { type: 'email', opted_in: !!data.email },
            { type: 'sms', opted_in: !!data.sms },
            { type: 'telephone', opted_in: !!data.telephone },
            { type: 'postMail', opted_in: !!data.post_mail },
            { type: 'siteNotification', opted_in: !!data.site_notification },
            { type: 'pushNotification', opted_in: !!data.push_notification }
        ];

        res.json(response);
    } catch (error) {
        logger.error('Failed to fetch consents', { correlationId, error: error.message });
        res.status(500).json({ error: 'Failed to fetch consents' });
    }
});

router.get('/userblocks/:userid', authenticateRequest, async (req, res) => {
    const { correlationId } = req;
    try {
        const data = await supabaseService.getUserBlocks(req.params.userid);

        // FT Compliance: Return specific block/exclusion payload
        const response = {
            blocked: !!data.blocked,
            excluded: !!data.excluded,
            last_modified: data.last_modified
        };

        res.json(response);
    } catch (error) {
        logger.error('Failed to fetch blocks', { correlationId, error: error.message });
        res.status(500).json({ error: 'Failed to fetch blocks' });
    }
});

router.post('/registration', authenticateRequest, async (req, res) => {
    const { correlationId, user } = req;
    try {
        await ftService.pushEvent(user.user_id, 'registration', {
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        }, { correlationId, brandId: user.brand_id });
        res.json({ success: true });
    } catch (error) {
        const errorMessage = typeof error === 'string' ? error : (error.message || 'Error occurred');
        res.status(500).json({ error: errorMessage });
    }
});

router.post('/logout', authenticateRequest, async (req, res) => {
    const { correlationId, user } = req;
    console.log(`[Operator Debug] Processing Logout for user ${user.id}`, { correlationId, operatorId: user.operator_id });
    try {
        // FT logout event is not required/supported by current integration version
        logger.info(`User ${user.id} logged out successfully`, { correlationId });
        res.json({ success: true });
    } catch (error) {
        const errorMessage = typeof error === 'string' ? error : (error.message || 'Error occurred');
        res.status(500).json({ error: errorMessage });
    }
});

// Wallet Operations
router.post('/deposit', authenticateRequest, async (req, res) => {
    const { correlationId, user } = req;
    const { amount } = req.body;

    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    try {
        const result = await WalletService.deposit(
            user.id, parseFloat(amount),
            user.operator_id, correlationId
        );
        res.json(result);
    } catch (error) {
        const errorMessage = typeof error === 'string' ? error : (error.message || 'Deposit failed');
        res.status(500).json({ error: errorMessage });
    }
});

router.get('/activities', authenticateRequest, async (req, res) => {
    try {
        const logs = await supabaseService.getActivities(req.user.operator_id);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// Bonus Operations
router.get('/bonus/list', authenticateRequest, async (req, res) => {
    // In production, fetch available bonuses from DB or Bonus Engine
    res.json({ Data: [] });
});

router.post('/bonus/credit', authenticateRequest, async (req, res) => {
    const { correlationId, user } = req;
    const { bonus_code } = req.body;

    try {
        const result = await WalletService.creditBonus(
            user.id,
            100, // Hardcoded amount for this endpoint matching list
            bonus_code,
            user.operator_id,
            correlationId
        );
        res.json({ success: true, message: `Bonus ${bonus_code} credited`, ...result });
    } catch (error) {
        const errorMessage = typeof error === 'string' ? error : (error.message || 'Bonus credit failed');
        res.status(500).json({ error: errorMessage });
    }
});

// User Details (Used by FT)
router.get('/userdetails/:userid', authenticateRequest, async (req, res) => {
    const { correlationId } = req;
    const user = await supabaseService.getUserById(req.params.userid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 100% FT Compliance: Include all 18+ required fields
    const response = {
        user_id: user.user_id, // Important: Use the public user_id
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        language: user.language || 'en',
        country: user.country || 'MT',
        currency: user.currency || 'EUR',
        balance: user.balance,
        bonus_balance: user.bonus_balance,
        registration_date: user.registration_date,
        verified_at: user.verified_at,
        birth_date: user.birth_date,
        sex: user.sex,
        title: user.title,
        address: user.address,
        city: user.city,
        postal_code: user.postal_code,
        mobile: user.mobile,
        mobile_prefix: user.mobile_prefix,
        origin: user.origin || 'Web',
        market: user.market || 'International',
        registration_code: user.registration_code,
        affiliate_reference: user.affiliate_reference,
        is_blocked: !!user.is_blocked,
        is_excluded: !!user.is_excluded,
        roles: Array.isArray(user.roles) ? user.roles : ['PLAYER'],
        brand_id: user.brand_id ? user.brand_id.toString() : '1'
    };

    await auditLog({
        correlationId,
        brandId: user.brand_id ? user.brand_id.toString() : '1',
        action: 'inbound:userdetails',
        entity_type: 'user',
        entity_id: user.id,
        metadata: { response },
        message: 'Shared user details with FT'
    });

    res.json(response);
});

const ReportingService = require('../services/reporting');

router.get('/stats/summary', authenticateRequest, async (req, res) => {
    const operatorId = req.user?.operator_id || req.operatorId || 'default';
    try {
        const summary = await ReportingService.getOperatorSummary(operatorId);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

router.get('/stats/churn', authenticateRequest, async (req, res) => {
    const operatorId = req.user?.operator_id || req.operatorId || 'default';
    try {
        const profiles = await ReportingService.getChurnRiskProfiles(operatorId);
        res.json(profiles);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch churn risk data' });
    }
});

router.get('/stats/live', authenticateRequest, async (req, res) => {
    const operatorId = req.user?.operator_id || req.operatorId || 'default';
    try {
        const metrics = await ReportingService.getLiveMetrics(operatorId);
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch live metrics' });
    }
});

const PaymentAnalyticsService = require('../services/payment-analytics');

router.post('/keys/rotate', authenticateRequest, requireAdmin, async (req, res) => {
    const { correlationId } = req;
    logger.info('API Key Rotation Request', { correlationId });

    // Logic: In production, generate new key in Supabase/Vault and invalidate old one
    const newKey = `sk_live_${Math.random().toString(36).substr(2, 24)}`;

    res.json({
        success: true,
        message: 'Master API Key rotated. Please update your environment variables.',
        key_preview: `${newKey.substr(0, 8)}...`
    });
});

router.get('/payment/health', authenticateRequest, async (req, res) => {
    try {
        const stats = PaymentAnalyticsService.getProviderStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch provider health' });
    }
});

module.exports = router;
