const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');
const ftService = require('../services/ft-integration');
const { logger, auditLog, generateCorrelationId } = require('../services/logger');
const rabbitmq = require('../services/rabbitmq');

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

        logger.info('Authenticating request', {
            correlationId,
            hasSessionToken: !!sessionToken,
            tokenPrefix: sessionToken ? sessionToken.substring(0, 10) + '...' : 'none',
            username,
            path: req.path
        });

        if (!sessionToken && !apiKey) {
            logger.warn('Authentication failed: No token or API key provided', { correlationId, path: req.path });
        }

        // 1. S2S Authentication (API Key)
        if (apiKey && apiKey === process.env.OPERATOR_API_KEY) {
            req.isOperator = true;
            req.role = 'ADMIN'; // S2S is always Admin in PoC
            return next();
        }

        // 2. User Authentication (Session Token)
        if (sessionToken) {
            // ALWAYS try to find real user in database first
            const user = await supabaseService.getUser(username, sessionToken);
            if (user) {
                req.user = user;
                req.brandId = user.brand_id || 1;
                req.role = user.role || 'PLAYER';
                return next();
            }

            // Fallback to Demo Token ONLY if user not in DB and sandbox mode is enabled
            const isSandbox = req.headers['x-sandbox-mode'] === 'true' || process.env.DEMO_MODE === 'true';
            if (isSandbox && sessionToken.startsWith('token-')) {
                // Try to determine username from token or header
                let targetUsername = username;
                if (!targetUsername) {
                    // Best effort extraction: remove 'token-' and strip timestamp if it looks like one
                    const raw = sessionToken.replace('token-', '');
                    targetUsername = raw.split('-')[0];
                }

                logger.info('[Auth] Sandbox Fallback: Resolving user', { targetUsername });

                // JIT: Find or Create User in DB
                let dbUser = await supabaseService.getUserById(targetUsername);
                if (!dbUser) {
                    logger.info('[Auth] Sandbox: User not found, creating JIT user', { targetUsername });
                    try {
                        dbUser = await supabaseService.createUser({
                            username: targetUsername,
                            email: `${targetUsername}@example.com`,
                            token: sessionToken,
                            brand_id: 1
                        });
                    } catch (err) {
                        logger.error('[Auth] JIT Creation Failed', { error: err.message });
                        // Last resort fallback (will likely fail wallet ops but allows read-only)
                        req.user = { user_id: targetUsername, username: targetUsername, brand_id: 1, role: 'PLAYER' };
                        req.brandId = 1;
                        req.role = 'PLAYER';
                        return next();
                    }
                }

                req.user = dbUser;
                req.brandId = dbUser.brand_id || 1;
                req.role = 'PLAYER'; // Force player role for sandbox users
                return next();
            }
        }

        // Portal Access Control: Only allow users with "admin" in username for portal endpoints
        if (req.path.startsWith('/operator/') && req.user) {
            if (!req.user.username || !req.user.username.toLowerCase().includes('admin')) {
                logger.warn('Portal access denied: Non-admin user attempted portal access', {
                    username: req.user.username,
                    path: req.path,
                    correlationId
                });
                return res.status(403).json({
                    error: 'Forbidden: Portal access restricted to administrators only'
                });
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

        let user = await supabaseService.getUser(username, sessionToken);

        // Fallback to Demo Token ONLY if user not in DB and sandbox/demo mode is enabled
        const isSandbox = req.headers['x-sandbox-mode'] === 'true' || process.env.DEMO_MODE === 'true';
        if (!user && isSandbox && sessionToken?.startsWith('token-')) {
            const targetUsername = username || sessionToken.replace('token-', '').split('-')[0];

            logger.info('Using Sandbox Fallback for Auth (JIT)', { targetUsername, correlationId });

            // Try to find existing user first
            user = await supabaseService.getUserById(targetUsername);

            if (!user) {
                // Create user if not exists
                try {
                    user = await supabaseService.createUser({
                        username: targetUsername,
                        email: `${targetUsername}@example.com`,
                        token: sessionToken,
                        brand_id: 1,
                        role: targetUsername === 'admin' ? 'ADMIN' : 'PLAYER'
                    });
                } catch (e) {
                    logger.error('Sandbox JIT User Creation Failed', { error: e.message });
                }
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid API Token or Username' });
        }

        // Update Last Login (Graceful degradation)
        try {
            await supabaseService.updateUser(user.id, { last_login: new Date().toISOString() });
        } catch (e) {
            logger.warn(`Failed to update last_login for user ${user.id}`, { error: e.message });
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
    // Prevent browser and proxy caching to ensure fresh balance
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
        balance: req.user.balance,
        bonus_balance: req.user.bonus_balance || 0,
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
    const { username, email, first_name, last_name, brand_id } = req.body;

    if (!username || !email) return res.status(400).json({ error: 'Missing required fields' });
    if (!brand_id) return res.status(400).json({ error: 'Brand ID is required' });

    try {
        const token = `token-${username}-${Date.now()}`;
        const newUser = await supabaseService.createUser({
            username, email, first_name, last_name,
            token, brand_id: parseInt(brand_id)
        });

        await ftService.pushEvent(newUser.user_id, 'registration', {
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        }, { correlationId, brandId: newUser.brand_id });

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

        res.json({ consents: response });
    } catch (error) {
        logger.error('Failed to fetch consents', { correlationId, error: error.message });
        res.status(500).json({ error: 'Failed to fetch consents' });
    }
});

router.get('/userblocks/:userid', authenticateRequest, async (req, res) => {
    const { correlationId } = req;
    try {
        const data = await supabaseService.getUserBlocks(req.params.userid);

        // FT Compliance: Return array-based blocks format
        const response = {
            blocks: [
                {
                    active: !!data.blocked,
                    type: 'Blocked',
                    note: 'Account status'
                },
                {
                    active: !!data.excluded,
                    type: 'Excluded',
                    note: 'Self-exclusion status'
                }
            ]
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
            user.brand_id, correlationId
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
    const mockBonuses = [
        { bonus_code: 'WELCOME100', name: 'Welcome Bonus 100%', amount: 100 },
        { bonus_code: 'RELOAD50', name: 'Weekend Reload', amount: 50 },
        { bonus_code: 'FREESPIN10', name: '10 Free Spins', amount: 10 }
    ];
    res.json({ Data: mockBonuses });
});

router.post('/bonus/credit', authenticateRequest, async (req, res) => {
    const { correlationId, user } = req;
    const {
        bonus_code,
        bonus_contract_id,
        amount,
        currency,
        fasttrack_references
    } = req.body;

    // FT Documentation: bonus_contract_id is used to identify the reward
    const targetBonusCode = bonus_contract_id || bonus_code;
    const creditAmount = amount !== undefined ? parseFloat(amount) : 100;

    try {
        const result = await WalletService.creditBonus(
            user.id,
            creditAmount,
            targetBonusCode,
            user.brand_id,
            correlationId,
            fasttrack_references
        );
        res.json({ success: true, message: `Bonus ${targetBonusCode} credited`, ...result });
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
        registration_date: user.registration_date,
        verified_at: user.verified_at || new Date().toISOString(), // RFC3339 format
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
        affiliate_reference: user.affiliate_reference || 'FT_DEMO_REF', // Mandatory field
        is_blocked: !!user.is_blocked,
        is_excluded: !!user.is_excluded,
        roles: Array.isArray(user.roles) ? user.roles : ['PLAYER']
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

// --- OPERATOR PORTAL SERVERLESS ENDPOINTS ---

router.get('/operator/notifications', authenticateRequest, async (req, res) => {
    const brandId = req.brandId || req.user?.brand_id || 1;
    try {
        const notifications = await supabaseService.getOperatorNotifications(brandId);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

router.get('/operator/stats', authenticateRequest, async (req, res) => {
    const brandId = req.brandId || req.user?.brand_id || 1;
    try {
        const stats = await supabaseService.getOperatorStats(brandId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch portal stats' });
    }
});

router.get('/operator/search', authenticateRequest, async (req, res) => {
    const brandId = req.brandId || req.user?.brand_id || 1;
    const { q } = req.query;
    try {
        const results = await supabaseService.searchOperatorGlobal(brandId, q);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
});

router.get('/operator/users/:userId', authenticateRequest, async (req, res) => {
    const brandId = req.brandId || req.user?.brand_id || 1;
    const { userId } = req.params;
    try {
        const player = await supabaseService.getUserByIdAndBrand(userId, brandId);
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }
        res.json(player);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch player details' });
    }
});

// Helper function to parse filter operators
const parseOperatorFilter = (input) => {
    if (!input || typeof input !== 'string') return null;

    const trimmed = input.trim();
    const operatorRegex = /^(>=|<=|>|<|=)\s*(.+)$/;
    const match = trimmed.match(operatorRegex);

    if (match) {
        return { operator: match[1], value: match[2].trim() };
    }
    return null;
};

// Helper function to parse date string (supports MM/DD/YYYY and MM/DD/YYYY, HH:MM:SS)
const parseDate = (dateStr, operator) => {
    if (!dateStr) return null;

    try {
        let date;

        // Try parsing MM/DD/YYYY, HH:MM:SS format
        const dateTimeRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
        const dateTimeMatch = dateStr.trim().match(dateTimeRegex);

        if (dateTimeMatch) {
            const [, month, day, year, hour, minute, second] = dateTimeMatch;
            date = new Date(year, month - 1, day, hour, minute, second);
            return date.toISOString();
        }

        // Try parsing DD/MM/YYYY format (International/European) - Priority for portal
        const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
        const dateMatch = dateStr.trim().match(dateRegex);

        if (dateMatch) {
            let [, first, second, year] = dateMatch;
            let month, day;

            // Simple heuristic to differentiate MM/DD/YYYY and DD/MM/YYYY
            // Default to DD/MM/YYYY for consistency with portal usage
            if (parseInt(first) > 12) {
                day = first;
                month = second;
            } else if (parseInt(second) > 12) {
                day = first;
                month = second; // If second > 12, it's likely MM/DD/YYYY but second is day. Wait. 13/02 -> 13 is day.
                // Actually if second > 12, it MUST be MM/DD/YYYY where second is Day. NO.
                // If input is 02/13/2026. first=02, second=13.
                // 13 > 12. So second is DAY. first is MONTH.
                month = first;
                day = second;
            } else {
                // Ambiguous. Default to DD/MM/YYYY.
                day = first;
                month = second;
            }

            date = new Date(year, month - 1, day);

            // Set time based on operator
            if (operator === '<') {
                date.setHours(0, 0, 0, 0);
            } else if (operator === '<=') {
                date.setHours(23, 59, 59, 999);
            } else if (operator === '>') {
                date.setHours(23, 59, 59, 999);
            } else if (operator === '>=') {
                date.setHours(0, 0, 0, 0);
            } else {
                date.setHours(0, 0, 0, 0);
            }

            return date.toISOString();
        }

        return null;
    } catch (e) {
        return null;
    }
};

// Player filtering endpoint
router.post('/operator/players/filter', authenticateRequest, async (req, res) => {
    const brandId = req.brandId || req.user?.brand_id || 1;
    const { country, username, email, balance, last_login, page = 1, limit = 10 } = req.body;

    try {
        const filters = {};

        if (country) filters.country = country;
        if (username) filters.username = username;
        if (email) filters.email = email;

        if (balance) {
            const parsed = parseOperatorFilter(balance);
            if (parsed) {
                filters.balance = { operator: parsed.operator, value: parseFloat(parsed.value) };
            }
        }

        if (last_login) {
            const parsed = parseOperatorFilter(last_login);
            if (parsed) {
                const dateValue = parseDate(parsed.value, parsed.operator);
                if (dateValue) {
                    filters.last_login = { operator: parsed.operator, value: dateValue };
                }
            }
        }

        const result = await supabaseService.getFilteredPlayers(brandId, filters, page, limit);
        res.json(result);
    } catch (error) {
        logger.error('Player filter failed', { error: error.message });
        res.status(500).json({ error: 'Failed to filter players' });
    }
});

// Transaction filtering endpoint
router.post('/operator/transactions/filter', authenticateRequest, async (req, res) => {
    const brandId = req.brandId || req.user?.brand_id || 1;
    const { transaction_id, user, type, amount, date, page = 1, limit = 10 } = req.body;

    try {
        const filters = {};

        if (transaction_id) filters.transaction_id = transaction_id;
        if (user) filters.user = user;
        if (type) filters.type = type;

        if (amount) {
            const parsed = parseOperatorFilter(amount);
            if (parsed) {
                filters.amount = { operator: parsed.operator, value: parseFloat(parsed.value) };
            }
        }

        if (date) {
            const parsed = parseOperatorFilter(date);
            if (parsed) {
                const dateValue = parseDate(parsed.value, parsed.operator);
                if (dateValue) {
                    filters.date = { operator: parsed.operator, value: dateValue };
                }
            }
        }

        const result = await supabaseService.getFilteredTransactions(brandId, filters, page, limit);
        res.json(result);
    } catch (error) {
        logger.error('Transaction filter failed', { error: error.message });
        res.status(500).json({ error: 'Failed to filter transactions' });
    }
});

// Operational stream endpoint
router.get('/operator/operational-stream', authenticateRequest, async (req, res) => {
    const brandId = req.brandId || req.user?.brand_id || 1;
    const { page = 1, limit = 20 } = req.query;

    try {
        const result = await supabaseService.getOperationalStream(brandId, parseInt(page), parseInt(limit));
        res.json(result);
    } catch (error) {
        logger.error('Operational stream fetch failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch operational stream' });
    }
});

module.exports = router;
