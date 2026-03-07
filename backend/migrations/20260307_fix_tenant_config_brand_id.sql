-- Migration: Fix tenant_configs brand_id indexing
-- Ensure brand_id column exists and is UNIQUE for PoC lookups
ALTER TABLE public.tenant_configs
ADD COLUMN IF NOT EXISTS brand_id INTEGER UNIQUE DEFAULT 1;
-- Backfill brand_id 1 for the default operator if not set
UPDATE public.tenant_configs
SET brand_id = 1
WHERE operator_id = '37562b54-0c91-491c-b996-2efb68e7baf3'
    AND brand_id IS NULL;