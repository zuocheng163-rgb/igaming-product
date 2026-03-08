-- ============================================================
-- F11: Duty of Care — Product Tiers
-- Version: v1.1  |  Applied: 2026-03-08
-- ============================================================

-- 1. Create product_tier type
DO $$ BEGIN
    CREATE TYPE product_offering_tier AS ENUM ('basic', 'advanced');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add product_tier to tenant_configs
ALTER TABLE tenant_configs
    ADD COLUMN IF NOT EXISTS product_tier product_offering_tier NOT NULL DEFAULT 'advanced';

-- 3. Ensure gamstop_enabled exists (it was in v1.0 but being safe)
ALTER TABLE tenant_configs
    ADD COLUMN IF NOT EXISTS gamstop_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Player-level flags for Advanced Tier
ALTER TABLE player_profiles
    ADD COLUMN IF NOT EXISTS bonus_suppressed BOOLEAN NOT NULL DEFAULT FALSE;

-- Audit
INSERT INTO public.platform_audit_logs (correlation_id, level, action, message)
VALUES (
    gen_random_uuid(),
    'info',
    'migration:f11_product_tiers',
    'F11 Duty of Care tiers added: product_tier (basic/advanced) + gamstop_enabled flag'
);
