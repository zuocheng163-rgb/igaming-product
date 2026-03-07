-- Migration: Add Duty of Care (Rule-Based) configuration columns to tenant_configs
-- F5: Configuration: Thresholds customizable via Tenant Portal
-- 1. Add columns to tenant_configs
ALTER TABLE public.tenant_configs
ADD COLUMN IF NOT EXISTS doc_affordability_threshold DECIMAL(12, 2) DEFAULT 1000.00,
    ADD COLUMN IF NOT EXISTS doc_velocity_spike_count INTEGER DEFAULT 5,
    ADD COLUMN IF NOT EXISTS doc_rapid_escalation_pct DECIMAL(5, 2) DEFAULT 100.00,
    -- 100% = doubling
ADD COLUMN IF NOT EXISTS doc_session_limit_minutes INTEGER DEFAULT 60;
-- 2. Update existing records with defaults if necessary
UPDATE public.tenant_configs
SET doc_affordability_threshold = COALESCE(doc_affordability_threshold, 1000.00),
    doc_velocity_spike_count = COALESCE(doc_velocity_spike_count, 5),
    doc_rapid_escalation_pct = COALESCE(doc_rapid_escalation_pct, 100.00),
    doc_session_limit_minutes = COALESCE(doc_session_limit_minutes, 60)
WHERE doc_affordability_threshold IS NULL;
-- 3. Log migration
INSERT INTO public.platform_audit_logs (correlation_id, level, action, message)
VALUES (
        gen_random_uuid(),
        'info',
        'migration:doc_config',
        'Added Duty of Care configuration columns to tenant_configs'
    );