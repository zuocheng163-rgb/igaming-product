-- F8: Bonus Wallet Module & F9: PSP Adapter Schema
-- Version: v0.6
-- 1. F8: Bonus Templates
CREATE TABLE IF NOT EXISTS bonus_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    brand_id INT DEFAULT 1,
    bonus_code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64) DEFAULT 'deposit_match',
    max_amount DECIMAL(12, 2),
    wagering_req INTEGER DEFAULT 35,
    win_cap DECIMAL(12, 2),
    expiry_days INTEGER DEFAULT 30,
    min_deposit DECIMAL(12, 2) DEFAULT 0.00,
    currency CHAR(3) DEFAULT 'EUR',
    contribution_rates JSONB DEFAULT '{"slots":1.0, "live":0.1, "table":0.1, "excluded":[]}',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand_id, bonus_code)
);
-- 2. F8: Bonus Instances
CREATE TABLE IF NOT EXISTS bonus_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    brand_id INT DEFAULT 1,
    player_id VARCHAR(255) NOT NULL,
    bonus_template_id UUID REFERENCES bonus_templates(id),
    bonus_code VARCHAR(64) NOT NULL,
    amount_credited DECIMAL(12, 2) NOT NULL,
    wagering_required DECIMAL(12, 2) NOT NULL,
    wagering_progress DECIMAL(12, 2) DEFAULT 0,
    win_cap DECIMAL(12, 2),
    winnings_accrued DECIMAL(12, 2) DEFAULT 0,
    state VARCHAR(32) DEFAULT 'CREATED',
    -- PENDING, CREATED, ONGOING, COMPLETED, FORFEITED, EXPIRED
    ft_idempotency_key VARCHAR(255) UNIQUE,
    -- X-Fasttrack-Id
    ft_activity_id VARCHAR(255),
    ft_action_id VARCHAR(255),
    ft_action_group_id VARCHAR(255),
    ft_trigger_hash VARCHAR(255),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 3. F8: Bonus Events (Audit Log)
CREATE TABLE IF NOT EXISTS bonus_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bonus_instance_id UUID REFERENCES bonus_instances(id),
    tenant_id UUID,
    brand_id INT DEFAULT 1,
    player_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    -- CREDITED, WAGER_CONTRIBUTION, WIN_RECORDED, RELEASED, EXPIRED, FORFEITED, FUNDS_CREDITED
    amount DECIMAL(12, 2),
    balance_after DECIMAL(12, 2),
    wagering_progress DECIMAL(12, 2),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 4. F9: Payment Transactions (Replaces standard Transactions for PSP intents)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    brand_id INT DEFAULT 1,
    player_id VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    -- NeoStrike idempotency key
    psp_tx_id VARCHAR(255),
    -- PSP reference
    psp_adapter VARCHAR(64) DEFAULT 'generic',
    event_type VARCHAR(64) NOT NULL,
    -- DEPOSIT, WITHDRAWAL, REFUND, CHARGEBACK
    amount DECIMAL(12, 2) NOT NULL,
    net_amount DECIMAL(12, 2),
    currency CHAR(3) DEFAULT 'EUR',
    payment_method VARCHAR(64),
    status VARCHAR(32) DEFAULT 'PENDING',
    -- PENDING, CONFIRMED, FAILED, REFUNDED, CHARGEDBACK
    balance_before DECIMAL(12, 2),
    balance_after DECIMAL(12, 2),
    raw_webhook JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);
-- 5. F9: PSP Webhook Log
CREATE TABLE IF NOT EXISTS psp_webhook_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    psp_adapter VARCHAR(64) NOT NULL,
    transaction_id VARCHAR(255),
    -- optional link
    payload JSONB NOT NULL,
    headers JSONB,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Migrate existing player_wallets if we had them or ensure users table captures bonus_balance
-- (Checked schemas: users table already has bonus_balance in current definitions!)