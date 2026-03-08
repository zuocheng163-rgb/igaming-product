const supabaseService = require('./supabase');
const ftService = require('./ft-integration');
const { logger, auditLog } = require('./logger');
const rabbitmq = require('./rabbitmq');
const MonitoringService = require('./monitoring');
const InterventionService = require('./intervention');
const PaymentRoutingService = require('./payment-routing');
const PaymentAdapters = require('../../mock-game/mock-services/payment-adapters');
const PaymentAnalyticsService = require('./payment-analytics');

/**
 * WalletService standardizes all balance-related operations.
 * It provides:
 * 1. Idempotency via transaction_locks
 * 2. Atomic updates (via Supabase)
 * 3. Unified Fast Track event triggering
 */
const getTenantId = (brandId) => {
    // brand_id 1 maps to 37562b54-0c91-491c-b996-2efb68e7baf3 as per tenant_configs
    if (brandId === 1 || brandId === '1') return '37562b54-0c91-491c-b996-2efb68e7baf3';
    return null;
};

class WalletService {
    /**
     * F10: KYC Gating Helper
     * Blocks operations based on user's kyc_status and wallet_blocked flag.
     */
    static checkKycGating(user, operation) {
        if (user.wallet_blocked) {
            logger.warn(`[KYC Gate] Operation ${operation} blocked: Wallet is BLOCKED`, { userId: user.id });
            throw new Error('PLAYER_BLOCKED');
        }

        // Example gating: Withdrawal requires VERIFIED
        if (operation === 'WITHDRAWAL' && user.kyc_status !== 'VERIFIED') {
            logger.warn(`[KYC Gate] Withdrawal blocked: KYC status is ${user.kyc_status}`, { userId: user.id });
            throw new Error('KYC_REQUIRED');
        }

        return true;
    }


    /**
     * Standardized Debit (Bet) operation
     */
    static async debit(userId, amount, transactionId, gameId, brandId, correlationId) {
        // Standardize brandId
        const normalizedBrandId = supabaseService.getBrandId(brandId);
        logger.debug(`[Wallet SPI] Processing Debit`, { userId, amount, transactionId, normalizedBrandId, correlationId });

        // 1. Check Idempotency
        const locked = await supabaseService.acquireLock(transactionId, normalizedBrandId);
        if (!locked) {
            logger.warn(`[Wallet SPI] Duplicate transaction ignored`, { transactionId, userId });
            const user = await supabaseService.getUserById(userId);
            return {
                transaction_id: transactionId,
                balance: user?.balance,
                bonus_balance: user?.bonus_balance,
                currency: user?.currency,
                duplicate: true
            };
        }

        try {
            const user = await supabaseService.getUserById(userId);
            if (!user) throw new Error('USER_NOT_FOUND');

            // F10: KYC Gating
            this.checkKycGating(user, 'DEBIT');

            // Use the actual brand_id from the user record
            const playerBrandId = user.brand_id || normalizedBrandId;

            const totalBalance = (user.balance || 0) + (user.bonus_balance || 0);
            if (totalBalance < amount) throw new Error('INSUFFICIENT_FUNDS');

            let remainingDebit = amount;
            let newBonusBalance = user.bonus_balance || 0;
            let newBalance = user.balance || 0;
            let bonusWager = 0;
            let realWager = 0;

            // F8 Wagering Order: Bonus balance is ALWAYS staked first
            if (newBonusBalance >= remainingDebit) {
                bonusWager = remainingDebit;
                newBonusBalance -= remainingDebit;
                remainingDebit = 0;
            } else {
                bonusWager = newBonusBalance;
                remainingDebit -= newBonusBalance;
                newBonusBalance = 0;

                realWager = remainingDebit;
                newBalance -= remainingDebit;
                remainingDebit = 0;
            }

            // F8 Wagering Contribution Logic
            const { data: activeBonuses } = await supabaseService.client
                .from('bonus_instances')
                .select('*')
                .eq('player_id', user.id)
                .in('state', ['CREATED', 'ONGOING'])
                .order('created_at', { ascending: true });

            if (activeBonuses && activeBonuses.length > 0) {
                for (const bonus of activeBonuses) {
                    // Update state to ONGOING if it was CREATED
                    let newState = bonus.state;
                    if (newState === 'CREATED') {
                        newState = 'ONGOING';
                    }

                    // F8 Wagering Contribution Logic: Use rates from template if available
                    let contributionRate = 1.0; // Default
                    if (bonus.bonus_template_id) {
                        const { data: template } = await supabaseService.client
                            .from('bonus_templates')
                            .select('contribution_rates')
                            .eq('id', bonus.bonus_template_id)
                            .single();

                        if (template && template.contribution_rates) {
                            // Map gameId to category if we had a mapping, for now use 'slots' default or check if gameId is excluded
                            const rates = template.contribution_rates;
                            // Basic logic: if games is 'slots', use 'slots' rate. Extension: check game index.
                            contributionRate = rates.slots || 1.0;

                            if (rates.excluded && Array.isArray(rates.excluded) && rates.excluded.includes(gameId)) {
                                contributionRate = 0;
                            }
                        }
                    }

                    const wageringContribution = amount * contributionRate;
                    const newProgress = (bonus.wagering_progress || 0) + wageringContribution;

                    let updatedBonusBalance = newBonusBalance;
                    let updatedRealBalance = newBalance;

                    if (newProgress >= bonus.wagering_required) {
                        newState = 'COMPLETED';
                        // Release bonus funds to real balance
                        updatedRealBalance += updatedBonusBalance;
                        updatedBonusBalance = 0;
                        newBalance = updatedRealBalance;
                        newBonusBalance = updatedBonusBalance;

                        await rabbitmq.publishEvent(`user.${userId}.bonus`, {
                            type: 'BONUS_CONVERTED',
                            bonus_code: bonus.bonus_code,
                            player_id: user.id
                        });
                    }

                    const { error: updateError } = await supabaseService.client
                        .from('bonus_instances')
                        .update({
                            wagering_progress: newProgress,
                            state: newState,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', bonus.id);
                    if (updateError) logger.error(`[Wallet SPI] Wagering Progress DB Error`, { error: updateError.message });

                    // Audit event
                    const { error: eventError } = await supabaseService.client.from('bonus_events').insert([{
                        bonus_instance_id: bonus.id,
                        tenant_id: bonus.tenant_id || getTenantId(bonus.brand_id), // Use mapped UUID
                        brand_id: bonus.brand_id,
                        player_id: user.id,
                        event_type: 'WAGER_CONTRIBUTION',
                        amount: wageringContribution,
                        wagering_progress: newProgress,
                        balance_after: updatedBonusBalance,
                        created_at: new Date().toISOString()
                    }]);
                    if (eventError) logger.error(`[Wallet SPI] Bonus Event DB Error`, { error: eventError.message });
                }
            }

            // Perform Update
            const updatedUser = await supabaseService.updateUser(user.id, {
                balance: newBalance,
                bonus_balance: newBonusBalance
            });

            // 2. Persist Transaction record with CORRECT brand_id
            await supabaseService.createTransaction({
                transaction_id: transactionId,
                brand_id: playerBrandId,
                user_id: user.id,
                type: 'DEBIT',
                status: 'success',
                amount: -amount,
                currency: user.currency,
                game_id: gameId,
                metadata: { correlationId, balance_after: newBalance }
            });

            // Audit
            await auditLog({
                correlationId,
                brandId: playerBrandId,
                actor_id: user.user_id, // Use public user_id for logs
                action: 'wallet:debit',
                entity_type: 'transaction',
                entity_id: transactionId,
                metadata: { request: { amount, gameId, balance_after: newBalance } },
                message: `SPI Debit Success: ${amount}`
            });

            // RabbitMQ Event Publish (Async)
            await rabbitmq.publishEvent(`user.${userId}.balance`, {
                type: 'balance_update',
                balance: newBalance,
                bonus_balance: newBonusBalance,
                currency: user.currency,
                userId
            });

            // FT Integration (Async)
            await ftService.pushEvent(user.user_id, 'bet', {
                amount,
                bonus_wager_amount: bonusWager,
                wager_amount: realWager,
                transaction_id: transactionId,
                game_id: gameId,
                balance_before: user.balance,
                bonus_balance_before: user.bonus_balance,
                balance_after: newBalance,
                bonus_balance_after: newBonusBalance,
                currency: user.currency
            }, { correlationId, brandId });

            // Balance Sync (Sync state after Bet)
            await ftService.pushEvent(user.user_id, 'balance', {
                balances: [
                    { amount: newBalance, currency: user.currency, key: 'real_money', exchange_rate: 1 },
                    { amount: newBonusBalance, currency: user.currency, key: 'bonus_money', exchange_rate: 1 }
                ]
            }, { correlationId, brandId });

            // AI Duty of Care: Evaluate Risk after transaction
            const riskData = await MonitoringService.evaluateRisk(user.user_id, amount, playerBrandId);
            if (riskData) {
                await InterventionService.handleRiskDetected(user.user_id, riskData, playerBrandId);
            }

            return {
                transaction_id: transactionId,
                balance: newBalance,
                bonus_balance: newBonusBalance,
                currency: user.currency
            };
        } catch (error) {
            logger.error(`[Wallet SPI] Debit Failed`, { error: error.message, correlationId });
            throw error;
        }
    }

    /**
     * Standardized Credit (Win) operation
     */
    static async credit(userId, amount, transactionId, gameId, brandId, correlationId) {
        const normalizedBrandId = supabaseService.getBrandId(brandId);
        logger.debug(`[Wallet SPI] Processing Credit`, { userId, amount, transactionId, normalizedBrandId, correlationId });

        const locked = await supabaseService.acquireLock(transactionId, normalizedBrandId);
        if (!locked) {
            const user = await supabaseService.getUserById(userId);
            return { transaction_id: transactionId, balance: user?.balance, currency: user?.currency, duplicate: true };
        }

        try {
            const user = await supabaseService.getUserById(userId);
            if (!user) throw new Error('USER_NOT_FOUND');

            // F10: KYC Gating
            this.checkKycGating(user, "CREDIT");

            const playerBrandId = user.brand_id || normalizedBrandId;

            // F8: Check for active bonuses to determine where to credit winnings
            const { data: activeBonuses } = await supabaseService.client
                .from('bonus_instances')
                .select('*')
                .eq('player_id', user.id)
                .in('state', ['CREATED', 'ONGOING'])
                .order('created_at', { ascending: true });

            let newBalance = user.balance + amount; // Business Logic: All wins go to Real Balance
            let newBonusBalance = user.bonus_balance || 0;
            const hasActiveBonus = activeBonuses && activeBonuses.length > 0;

            if (hasActiveBonus) {
                // Track winnings in the active bonus instance (accrue to oldest)
                const bonus = activeBonuses[0];
                const updatedWinnings = (bonus.winnings_accrued || 0) + amount;

                await supabaseService.client
                    .from('bonus_instances')
                    .update({
                        winnings_accrued: updatedWinnings,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', bonus.id);

                // Log Bonus event
                await supabaseService.client.from('bonus_events').insert([{
                    bonus_instance_id: bonus.id,
                    brand_id: playerBrandId,
                    tenant_id: bonus.tenant_id || getTenantId(playerBrandId),
                    player_id: user.id,
                    event_type: 'WIN_RECORDED',
                    amount: amount,
                    balance_after: newBonusBalance,
                    created_at: new Date().toISOString()
                }]);

                logger.info(`[Wallet SPI] Win credited to Real (Bonus Active)`, { userId, amount, newBalance });
            }

            await supabaseService.updateUser(user.id, {
                balance: newBalance,
                bonus_balance: newBonusBalance
            });

            // Persist Transaction record
            await supabaseService.createTransaction({
                transaction_id: transactionId,
                brand_id: playerBrandId,
                user_id: user.id,
                type: 'CREDIT',
                status: 'success',
                amount: amount,
                currency: user.currency,
                game_id: gameId,
                metadata: { correlationId, balance_after: newBalance, bonus_balance_after: newBonusBalance }
            });

            await auditLog({
                correlationId,
                brandId: playerBrandId,
                actor_id: user.user_id,
                action: 'wallet:credit',
                entity_type: 'transaction',
                entity_id: transactionId,
                metadata: { request: { amount, gameId, balance_after: newBalance, bonus_balance_after: newBonusBalance } },
                message: `SPI Credit Success: ${amount}`
            });

            await ftService.pushEvent(user.user_id, 'win', {
                amount,
                transaction_id: transactionId,
                game_id: gameId,
                balance_before: user.balance,
                balance_after: newBalance,
                bonus_balance_after: newBonusBalance,
                currency: user.currency
            }, { correlationId, brandId });

            // Balance Sync (Sync state after Win)
            await ftService.pushEvent(user.user_id, 'balance', {
                balances: [
                    { amount: newBalance, currency: user.currency, key: 'real_money', exchange_rate: 1 },
                    { amount: newBonusBalance, currency: user.currency, key: 'bonus_money', exchange_rate: 1 }
                ]
            }, { correlationId, brandId });

            // AI Duty of Care: Evaluate Risk after transaction
            const riskData = await MonitoringService.evaluateRisk(user.user_id, amount, playerBrandId);
            if (riskData) {
                await InterventionService.handleRiskDetected(user.user_id, riskData, playerBrandId);
            }

            return {
                transaction_id: transactionId,
                balance: newBalance,
                bonus_balance: newBonusBalance,
                currency: user.currency
            };
        } catch (error) {
            logger.error(`[Wallet SPI] Credit Failed`, { error: error.message, correlationId });
            throw error;
        }
    }

    /**
     * Standardized Deposit (Payment) operation with Auto-Retry and Failover
     */
    static async deposit(userId, amount, method, brandId, correlationId) {
        const normalizedBrandId = supabaseService.getBrandId(brandId);
        logger.debug(`[Wallet SPI] Processing Deposit`, { userId, amount, method, normalizedBrandId, correlationId });
        const transactionId = `dep-${Date.now()}`;

        try {

            const user = await supabaseService.getUserById(userId);
            if (!user) throw new Error('USER_NOT_FOUND');

            // F10: KYC Gating
            this.checkKycGating(user, "DEPOSIT");
            if (!user) throw new Error('USER_NOT_FOUND');

            const playerBrandId = user.brand_id || normalizedBrandId;

            // 1. External Payment Orchestration (Adyen -> Stripe)
            const paymentResult = await this._orchestrateExternalPayment(userId, amount, method, correlationId);

            if (paymentResult.status !== 'Approved') {
                throw new Error(`PAYMENT_REJECTED: ${paymentResult.reason}`);
            }

            const newBalance = (user.balance || 0) + amount;
            await supabaseService.updateUser(user.id, { balance: newBalance });

            // 2. Persist Transaction record
            await supabaseService.createTransaction({
                transaction_id: transactionId,
                brand_id: playerBrandId,
                user_id: user.id,
                type: 'DEPOSIT',
                status: 'success',
                amount: amount,
                currency: user.currency,
                metadata: { correlationId, provider: paymentResult.provider, balance_after: newBalance }
            });

            await auditLog({
                correlationId,
                brandId: playerBrandId,
                actor_id: user.user_id,
                action: 'wallet:deposit',
                entity_type: 'transaction',
                entity_id: transactionId,
                metadata: { request: { amount, balance_after: newBalance, provider: paymentResult.provider } },
                message: `SPI Deposit Success: ${amount} via ${paymentResult.provider}`
            });

            // FT Integration: Push payment event
            ftService.pushEvent(user.user_id, 'deposit', {
                amount,
                transaction_id: transactionId,
                currency: user.currency,
                status: 'Approved',
                provider: paymentResult.provider
            }, { correlationId, brandId });

            // Balance Sync (Sync state after Deposit)
            await ftService.pushEvent(user.user_id, 'balance', {
                balances: [
                    { amount: newBalance, currency: user.currency, key: 'real_money', exchange_rate: 1 },
                    { amount: user.bonus_balance || 0, currency: user.currency, key: 'bonus_money', exchange_rate: 1 }
                ]
            }, { correlationId, brandId });

            // RabbitMQ Event
            await rabbitmq.publishEvent(`user.${userId}.balance`, {
                type: 'balance_update',
                balance: newBalance,
                bonus_balance: user.bonus_balance || 0,
                currency: user.currency,
                userId
            });

            await rabbitmq.publishEvent(`user.${userId}.payment`, {
                type: 'payment_status',
                status: 'success',
                amount,
                method,
                provider: paymentResult.provider,
                userId
            });

            // AI Duty of Care: Evaluate Risk after transaction (Chasing losses detection)
            const riskData = await MonitoringService.evaluateRisk(user.user_id, amount, playerBrandId);
            if (riskData) {
                await InterventionService.handleRiskDetected(user.user_id, riskData, playerBrandId);
            }

            return {
                transaction_id: transactionId,
                balance: newBalance,
                bonus_balance: user.bonus_balance || 0,
                currency: user.currency,
                provider: paymentResult.provider
            };
        } catch (error) {
            logger.error(`[Wallet SPI] Deposit Failed`, { error: error.message, correlationId });

            // Notify via RabbitMQ of failure
            await rabbitmq.publishEvent(`user.${userId}.payment`, {
                type: 'payment_status',
                status: 'failed',
                amount,
                reason: error.message,
                userId
            });

            throw error;
        }
    }

    /**
     * Internal orchestration with retry and failover
     */
    static async _orchestrateExternalPayment(userId, amount, method, correlationId) {
        const user = await supabaseService.getUserById(userId);
        const country = user?.country || 'MT';

        const providers = PaymentRoutingService.getProviderSequence(country, amount);
        const retryDelays = [1000, 3000]; // Faster retries for orchestration v2

        for (const provider of providers) {
            logger.info(`Attempting payment via ${provider}`, { userId, amount, provider, country });

            for (let i = 0; i <= retryDelays.length; i++) {
                const startTime = Date.now();
                try {
                    const result = await PaymentAdapters.call(provider, amount, userId);
                    await PaymentAnalyticsService.logAttempt(provider, 'Approved', amount, Date.now() - startTime, userId, country);
                    return result;
                } catch (err) {
                    const latency = Date.now() - startTime;
                    logger.warn(`Payment attempt ${i + 1} failed for ${provider}: ${err.message}`);
                    await PaymentAnalyticsService.logAttempt(provider, 'Failed', amount, latency, userId, country);

                    if (i < retryDelays.length) {
                        await new Promise(r => setTimeout(r, retryDelays[i]));
                    }
                }
            }
            logger.warn(`Provider ${provider} failed. Switching to next in sequence...`);
        }

        throw new Error('ALL_PAYMENT_PROVIDERS_FAILED');
    }

    /**
     * Standardized Bonus Credit operation (F8)
     */
    static async creditBonus(userId, amount, bonusCode, brandId, correlationId, fasttrackReferences = null) {
        const normalizedBrandId = supabaseService.getBrandId(brandId);
        logger.debug(`[Wallet SPI] Processing Bonus Credit`, { userId, amount, bonusCode, normalizedBrandId, correlationId });
        const transactionId = `bon-${Date.now()}`;

        // Idempotency: X-Fasttrack-Id
        const idempotencyKey = fasttrackReferences?.id || transactionId;
        const { data: existingBonus } = await supabaseService.client
            .from('bonus_instances')
            .select('*')
            .eq('ft_idempotency_key', idempotencyKey)
            .single();

        if (existingBonus) {
            logger.warn(`[Wallet SPI] Duplicate FT bonus credit ignored`, { idempotencyKey, userId });
            const user = await supabaseService.getUserById(userId);
            return {
                transaction_id: existingBonus.id,
                balance: user?.balance,
                bonus_balance: user?.bonus_balance,
                currency: user?.currency,
                duplicate: true
            };
        }


        try {
            const user = await supabaseService.getUserById(userId);
            if (!user) throw new Error('USER_NOT_FOUND');

            // F10: KYC Gating
            this.checkKycGating(user, "BONUS_CREDIT");
            if (!user) throw new Error('USER_NOT_FOUND');

            const playerBrandId = user.brand_id || normalizedBrandId;

            // Fetch bonus template
            const { data: template } = await supabaseService.client
                .from('bonus_templates')
                .select('*')
                .eq('brand_id', playerBrandId)
                .eq('bonus_code', bonusCode)
                .single();

            const wageringMultiplier = template ? (template.wagering_req || 35) : 35;
            const wageringRequired = amount * wageringMultiplier;
            const newBonusBalance = (user.bonus_balance || 0) + (parseFloat(amount) || 0);

            // Calculate expiry
            const wageringExpiryDays = template ? (template.wagering_expiry_days || 30) : 30;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + wageringExpiryDays);

            await supabaseService.updateUser(user.id, { bonus_balance: newBonusBalance });

            // Create Bonus Instance
            const { data: newBonusInst, error: bonusError } = await supabaseService.client
                .from('bonus_instances')
                .insert([{
                    brand_id: playerBrandId,
                    tenant_id: getTenantId(playerBrandId),
                    player_id: user.id,
                    bonus_template_id: template ? template.id : null,
                    bonus_code: bonusCode,
                    amount_credited: parseFloat(amount),
                    wagering_required: wageringRequired,
                    state: 'CREATED',
                    expires_at: expiresAt.toISOString(),
                    ft_idempotency_key: idempotencyKey,
                    ft_activity_id: fasttrackReferences?.activity_id,
                    ft_action_id: fasttrackReferences?.action_id,
                    ft_action_group_id: fasttrackReferences?.action_group_id,
                    ft_trigger_hash: fasttrackReferences?.trigger_hash
                }])
                .select()
                .single();

            if (bonusError) {
                logger.error('[Wallet SPI] Failed to insert bonus_instances', { error: bonusError.message });
                throw bonusError;
            }

            // Log Bonus Event
            if (newBonusInst) {
                const { error: eventError } = await supabaseService.client.from('bonus_events').insert([{
                    bonus_instance_id: newBonusInst.id,
                    brand_id: playerBrandId,
                    tenant_id: getTenantId(playerBrandId),
                    player_id: user.id,
                    event_type: 'CREDITED',
                    amount: parseFloat(amount),
                    balance_after: newBonusBalance
                }]);
                if (eventError) logger.error('[Wallet SPI] Failed to log CREDITED bonus_events', { error: eventError.message });
            }

            await auditLog({
                correlationId,
                brandId: playerBrandId,
                actor_id: user.user_id,
                action: 'wallet:bonus_credit',
                entity_type: 'transaction',
                entity_id: transactionId,
                metadata: { request: { amount, bonusCode, bonus_balance_after: newBonusBalance } },
                message: `SPI Bonus Credit Success: ${amount}`
            });

            // FT Integration: Push bonus event
            await ftService.pushEvent(user.user_id, 'bonus', {
                bonus_code: bonusCode,
                amount: parseFloat(amount) || 0,
                status: 'Completed',
                transaction_id: transactionId,
                currency: user.currency,
                fasttrack_references: fasttrackReferences || { source: 'backend' }
            }, { correlationId, brandId });

            // RabbitMQ
            await rabbitmq.publishEvent(`user.${userId}.bonus`, {
                type: 'BONUS_AWARDED',
                bonus_code: bonusCode,
                amount: parseFloat(amount),
                player_id: user.id,
                ft_idempotency_key: idempotencyKey
            });

            // Balance Sync
            await ftService.pushEvent(user.user_id, 'balance', {
                balances: [
                    { amount: user.balance || 0, currency: user.currency, key: 'real_money', exchange_rate: 1 },
                    { amount: newBonusBalance, currency: user.currency, key: 'bonus_money', exchange_rate: 1 }
                ]
            }, { correlationId, brandId });

            return {
                bonus_instance_id: newBonusInst ? newBonusInst.id : transactionId,
                balance: user.balance,
                bonus_balance: newBonusBalance,
                wagering_required: wageringRequired,
                wagering_progress: 0,
                currency: user.currency
            };
        } catch (error) {
            logger.error(`[Wallet SPI] Bonus Credit Failed`, { error: error.message, correlationId });
            throw error;
        }
    }

    /**
     * Bonus Funds Credit (No Wagering, direct to real/bonus balance)
     */
    static async creditBonusFunds(userId, amount, reason, brandId, correlationId, fasttrackReferences = null) {
        const normalizedBrandId = supabaseService.getBrandId(brandId);
        logger.debug(`[Wallet SPI] Processing Bonus Funds`, { userId, amount, reason, correlationId });
        const transactionId = `funds-${Date.now()}`;

        // Idempotency
        const idempotencyKey = fasttrackReferences?.id || transactionId;
        const { data: existingEvent } = await supabaseService.client
            .from('bonus_events')
            .select('*')
            .eq('metadata->>ft_idempotency_key', idempotencyKey)
            .single();

        if (existingEvent) {
            const user = await supabaseService.getUserById(userId);
            return { transaction_id: transactionId, balance: user?.balance, duplicate: true };
        }

        try {
            const user = await supabaseService.getUserById(userId);
            if (!user) throw new Error('USER_NOT_FOUND');

            // F10: KYC Gating
            this.checkKycGating(user, 'BONUS_FUNDS');

            // Funds credit directly adds to balance (as per PRD: POST /bonus/credit/funds adds to bonus balance but released on next wager, or just directly to wallet depending on operator config. We credit bonus_balance and let it be used).
            const newBonusBalance = (user.bonus_balance || 0) + parseFloat(amount);
            await supabaseService.updateUser(user.id, { bonus_balance: newBonusBalance });

            const { error: eventError } = await supabaseService.client.from('bonus_events').insert([{
                brand_id: user.brand_id || normalizedBrandId,
                tenant_id: getTenantId(user.brand_id || normalizedBrandId),
                player_id: user.id,
                event_type: 'FUNDS_CREDITED',
                amount: parseFloat(amount),
                balance_after: newBonusBalance,
                metadata: { reason, ft_idempotency_key: idempotencyKey }
            }]);
            if (eventError) {
                logger.error('[Wallet SPI] Failed to insert bonus_events for funds', { error: eventError.message });
                throw eventError;
            }

            // RabbitMQ
            await rabbitmq.publishEvent(`user.${userId}.bonus`, {
                type: 'FUNDS_CREDITED',
                amount: parseFloat(amount),
                player_id: user.id
            });

            return {
                transaction_id: transactionId,
                bonus_balance: newBonusBalance,
                real_balance: user.balance
            };
        } catch (error) {
            logger.error(`[Wallet SPI] Bonus Funds Failed`, { error: error.message });
            throw error;
        }
    }

    /**
     * Initiate Deposit (F9)
     */
    static async initiateDeposit(userId, amount, currency, returnUrl, brandId, correlationId) {
        const normalizedBrandId = supabaseService.getBrandId(brandId);
        const transactionId = `pmt-${Date.now()}`;

        const user = await supabaseService.getUserById(userId);
        if (!user) throw new Error('USER_NOT_FOUND');

        // F10: KYC Gating
        this.checkKycGating(user, 'DEPOSIT_INIT');

        // Create pending payment transaction
        const { error: pmtError } = await supabaseService.client.from('payment_transactions').insert([{
            brand_id: user.brand_id || normalizedBrandId,
            player_id: user.id,
            transaction_id: transactionId,
            event_type: 'DEPOSIT',
            amount: parseFloat(amount),
            currency: currency || 'EUR',
            status: 'PENDING'
        }]);

        if (pmtError) {
            logger.error('[Wallet SPI] Failed to insert payment_transactions', { error: pmtError.message });
            throw pmtError;
        }

        // Mocking Nuvei checkout URL generation for v0.6
        return {
            transaction_id: transactionId,
            checkout_url: `https://checkout.nuvei.com/test?session=${transactionId}`,
            expires_at: new Date(Date.now() + 3600000).toISOString() // +1h
        };
    }

    /**
     * Confirm Deposit from PSP Webhook (F9)
     */
    static async confirmDeposit(pspTxId, transactionId, amount, netAmount, paymentMethod, pspAdapter, vendorId) {
        const { data: pmt } = await supabaseService.client
            .from('payment_transactions')
            .select('*')
            .eq('transaction_id', transactionId)
            .single();

        if (!pmt) throw new Error('TRANSACTION_NOT_FOUND');
        if (pmt.status === 'CONFIRMED') return pmt; // Idempotent

        const user = await supabaseService.getUserById(pmt.player_id);
        if (!user) throw new Error('USER_NOT_FOUND');

        // F10: KYC Gating
        this.checkKycGating(user, 'DEPOSIT_CONFIRM');

        const newBalance = (user.balance || 0) + parseFloat(amount);

        // Update Wallet
        await supabaseService.updateUser(user.id, { balance: newBalance });

        // Update Transaction
        const { data: updatedPmt } = await supabaseService.client.from('payment_transactions').update({
            status: 'CONFIRMED',
            psp_tx_id: pspTxId,
            psp_adapter: pspAdapter,
            net_amount: netAmount,
            payment_method: paymentMethod,
            balance_before: user.balance,
            balance_after: newBalance,
            confirmed_at: new Date().toISOString()
        }).eq('id', pmt.id).select().single();

        // Audit & RabbitMQ
        await auditLog({
            correlationId: `sys-${Date.now()}`,
            brandId: pmt.brand_id,
            actor_id: user.user_id,
            action: 'wallet:deposit_webhook',
            entity_type: 'payment_transactions',
            entity_id: transactionId,
            message: `SPI Deposit Confirmed via webhook: ${amount} via ${pspAdapter}`
        });

        // Publish F9 DEPOSIT Event to RabbitMQ (Triggering Fast Track)
        await rabbitmq.publishEvent('payments.confirmed', {
            type: 'DEPOSIT',
            transaction_id: transactionId,
            psp_tx_id: pspTxId,
            player_id: user.id,
            amount: parseFloat(amount),
            net_amount: netAmount,
            currency: pmt.currency,
            payment_method: paymentMethod,
            vendor_id: vendorId || pspAdapter,
            vendor_name: pspAdapter,
            status: 'CONFIRMED',
            timestamp: new Date().toISOString()
        });

        // Fast Track API integration
        await ftService.pushEvent(user.user_id, 'deposit', {
            amount,
            transaction_id: transactionId,
            currency: pmt.currency,
            status: 'Approved',
            provider: pspAdapter
        });

        // AI Duty of Care: Evaluate Risk after confirmation
        const riskData = await MonitoringService.evaluateRisk(user.user_id, amount, pmt.brand_id);
        if (riskData) {
            await InterventionService.handleRiskDetected(user.user_id, riskData, pmt.brand_id);
        }

        return updatedPmt;
    }
}

module.exports = WalletService;
