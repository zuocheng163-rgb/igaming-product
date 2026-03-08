-- ============================================================
-- F11: Duty of Care — Full RG Schema
-- Version: v1.0  |  Applied: 2026-03-08
-- ============================================================

-- 1. Player RG Limits (player-controlled deposit/loss/wager/session limits)
CREATE TABLE IF NOT EXISTS player_rg_limits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id           VARCHAR(255) NOT NULL,
    tenant_id           UUID NOT NULL,
    limit_type          VARCHAR(32) NOT NULL CHECK (limit_type IN ('deposit','loss','wager','session_time')),
    period              VARCHAR(32) NOT NULL CHECK (period IN ('daily','weekly','monthly','per_session')),
    current_value       DECIMAL(14,2),           -- NULL means no limit active for numeric types, minutes for session_time
    pending_value       DECIMAL(14,2),           -- SET when player requested an increase (requires cooling period)
    pending_effective_at TIMESTAMPTZ,            -- When pending_value becomes current_value
    previous_value      DECIMAL(14,2),           -- For rollback reference
    set_by_player_at    TIMESTAMPTZ DEFAULT NOW(),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (player_id, tenant_id, limit_type, period)
);

CREATE INDEX IF NOT EXISTS idx_rg_limits_player ON player_rg_limits(player_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_rg_limits_pending ON player_rg_limits(pending_effective_at)
    WHERE pending_value IS NOT NULL;

-- 2. RG Player Metrics (composite risk score + monitoring state)
CREATE TABLE IF NOT EXISTS rg_player_metrics (
    player_id           VARCHAR(255) NOT NULL,
    tenant_id           UUID NOT NULL,
    composite_score     INTEGER NOT NULL DEFAULT 0,
    score_breakdown     JSONB NOT NULL DEFAULT '{}',
    -- e.g. {"net_loss_tier":3,"return_pattern":2,"baseline_deviation":2,"chasing_losses":2}
    monitoring_active   BOOLEAN NOT NULL DEFAULT FALSE,    -- true after 56 days of account age
    net_loss_tier       VARCHAR(16) NOT NULL DEFAULT 'none'
                            CHECK (net_loss_tier IN ('none','tier1','tier2','tier3')),
    baseline_deposit_median  DECIMAL(14,2),               -- 90-day rolling median, updated by daily job
    last_score_updated_at    TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (player_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_rg_metrics_score ON rg_player_metrics(tenant_id, composite_score DESC)
    WHERE monitoring_active = TRUE;

-- 3. RG Audit Log (append-only event log — 7-year retention)
CREATE TABLE IF NOT EXISTS rg_audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    player_id   VARCHAR(255) NOT NULL,
    event_type  VARCHAR(64) NOT NULL CHECK (event_type IN (
                    'RG_LIMIT_DECREASED',
                    'RG_LIMIT_INCREASE_PENDING',
                    'RG_LIMIT_INCREASE_EFFECTIVE',
                    'RG_LIMIT_CANCELLED',
                    'RG_SELF_EXCLUSION_APPLIED',
                    'RG_GAMSTOP_BLOCK',
                    'RG_HARM_SIGNAL_DETECTED',
                    'RG_REALITY_CHECK_SENT',
                    'RG_MANDATORY_BREAK_TRIGGERED',
                    'RG_WELFARE_CHECK_SENT',
                    'RG_BONUS_SUPPRESSED',
                    'RG_EDD_PENDING_SET'
                )),
    payload     JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log is append-only — prevent updates and deletes
CREATE OR REPLACE RULE rg_audit_no_update AS ON UPDATE TO rg_audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE rg_audit_no_delete AS ON DELETE TO rg_audit_log DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS idx_rg_audit_player ON rg_audit_log(player_id, tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_rg_audit_type   ON rg_audit_log(tenant_id, event_type, occurred_at DESC);

-- 4. RG Return Events (rapid return after loss detection)
CREATE TABLE IF NOT EXISTS rg_return_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id           VARCHAR(255) NOT NULL,
    tenant_id           UUID NOT NULL,
    session_ended_at    TIMESTAMPTZ NOT NULL,
    net_session_loss    DECIMAL(14,2) NOT NULL DEFAULT 0,  -- positive = player lost
    returned_at         TIMESTAMPTZ,                       -- NULL until player logs in again
    minutes_gap         INTEGER,                           -- NULL until return detected
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rg_return_player ON rg_return_events(player_id, tenant_id, session_ended_at DESC);

-- 5. Extend player_profiles with self-exclusion and GAMSTOP fields
ALTER TABLE player_profiles
    ADD COLUMN IF NOT EXISTS self_exclusion_type VARCHAR(16) DEFAULT 'none'
        CHECK (self_exclusion_type IN ('none','temporary','permanent','gamstop')),
    ADD COLUMN IF NOT EXISTS self_exclusion_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gamstop_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS edd_pending          BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS edd_pending_since    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_exclusion ON player_profiles(self_exclusion_type)
    WHERE self_exclusion_type != 'none';

-- 6. Extend tenant_configs with F11 DoC thresholds
ALTER TABLE tenant_configs
    -- Responsible Gambling thresholds
    ADD COLUMN IF NOT EXISTS rg_return_window_minutes       INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS rg_return_pattern_count        INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS rg_chasing_consecutive_deposits INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS rg_net_tier1                   DECIMAL(12,2) NOT NULL DEFAULT 500.00,
    ADD COLUMN IF NOT EXISTS rg_net_tier2                   DECIMAL(12,2) NOT NULL DEFAULT 2000.00,
    ADD COLUMN IF NOT EXISTS rg_net_tier3                   DECIMAL(12,2) NOT NULL DEFAULT 5000.00,
    ADD COLUMN IF NOT EXISTS rg_soft_suppress_score         INTEGER NOT NULL DEFAULT 6,
    ADD COLUMN IF NOT EXISTS rg_hard_suppress_score         INTEGER NOT NULL DEFAULT 9,
    -- Jurisdiction profile (drives UI field caps)
    ADD COLUMN IF NOT EXISTS rg_jurisdiction                VARCHAR(32) NOT NULL DEFAULT 'custom'
        CHECK (rg_jurisdiction IN ('ukgc','mga','curacao','brazil','germany','italy','custom')),
    -- GAMSTOP integration (only active when gamstop_enabled=true AND GAMSTOP_API_KEY is set)
    ADD COLUMN IF NOT EXISTS gamstop_enabled                BOOLEAN NOT NULL DEFAULT FALSE;

-- Audit
INSERT INTO public.platform_audit_logs (correlation_id, level, action, message)
VALUES (
    gen_random_uuid(),
    'info',
    'migration:f11_duty_of_care',
    'F11 Duty of Care schema applied: player_rg_limits, rg_player_metrics, rg_audit_log, rg_return_events + player_profiles/tenant_configs extensions'
);
