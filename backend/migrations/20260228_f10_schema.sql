-- F10: Identity & KYC Connector Schema
-- Version: v0.7
-- 1. F10: Player Profiles (GDPR Minimum Profile)
CREATE TABLE IF NOT EXISTS player_profiles (
    player_id VARCHAR(255) PRIMARY KEY,
    -- Supabase Auth sub UUID
    tenant_id UUID,
    email VARCHAR(255),
    display_name VARCHAR(255),
    country CHAR(2),
    language CHAR(5),
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
-- 2. F10: Wallet KYC Columns
-- Expanding existing users/player_wallets table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(32) DEFAULT 'NOT_STARTED';
ALTER TABLE users
ADD COLUMN IF NOT EXISTS wallet_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE users
ADD COLUMN IF NOT EXISTS sumsub_applicant_id VARCHAR(255);
ALTER TABLE users
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;
-- 3. F10: KYC Events Audit Log
CREATE TABLE IF NOT EXISTS kyc_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    player_id VARCHAR(255) NOT NULL,
    -- Supabase Auth sub UUID
    event_type VARCHAR(64) NOT NULL,
    -- STATUS_CHANGED, WEBHOOK_RECEIVED, INITIATION_CREATED, GATE_BLOCKED
    previous_status VARCHAR(64),
    new_status VARCHAR(64),
    sumsub_review_answer VARCHAR(32),
    sumsub_reject_type VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 4. F10: Identity Connector Config
CREATE TABLE IF NOT EXISTS identity_connector_config (
    tenant_id UUID PRIMARY KEY,
    auth_provider VARCHAR(32) DEFAULT 'supabase',
    supabase_url VARCHAR(512),
    supabase_anon_key TEXT,
    jwks_cache_ttl_sec INTEGER DEFAULT 3600,
    kyc_provider VARCHAR(32) DEFAULT 'sumsub',
    sumsub_app_token TEXT,
    sumsub_secret_key TEXT,
    sumsub_webhook_secret TEXT,
    sumsub_level_name VARCHAR(255),
    gate_deposit VARCHAR(32) DEFAULT 'none',
    gate_withdrawal VARCHAR(32) DEFAULT 'VERIFIED',
    gate_bonus VARCHAR(32) DEFAULT 'none',
    gate_game_launch VARCHAR(32) DEFAULT 'none',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);