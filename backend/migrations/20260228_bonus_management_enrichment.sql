-- Migration: Bonus Management Enrichment (F8-BM)
-- Description: Extends bonus_templates and adds bulk_issue_jobs table.
-- 1. Extend bonus_templates
ALTER TABLE bonus_templates
ADD COLUMN IF NOT EXISTS wagering_type VARCHAR(32) DEFAULT 'both',
    -- real, bonus, both
ADD COLUMN IF NOT EXISTS match_percentage INTEGER,
    -- For deposit match bonuses
ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS claim_expiry_days INTEGER DEFAULT 7,
    ADD COLUMN IF NOT EXISTS wagering_expiry_days INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS eligibility_rules JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS game_restrictions JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS manual_issuance_only BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
-- Ensure description exists (in case previous migration wasn't run)
ALTER TABLE bonus_templates
ADD COLUMN IF NOT EXISTS description TEXT;
-- 2. Create bulk_issue_jobs table
CREATE TABLE IF NOT EXISTS bulk_issue_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id INT DEFAULT 1,
    template_id UUID REFERENCES bonus_templates(id),
    status VARCHAR(32) DEFAULT 'PENDING',
    -- PENDING, PROCESSING, COMPLETED, FAILED
    total_players INTEGER DEFAULT 0,
    processed_players INTEGER DEFAULT 0,
    error_log JSONB DEFAULT '[]',
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 3. Add index for performance on active bonuses
CREATE INDEX IF NOT EXISTS idx_bonus_instances_player_state ON bonus_instances(player_id, state);
CREATE INDEX IF NOT EXISTS idx_bonus_instances_template ON bonus_instances(bonus_template_id);