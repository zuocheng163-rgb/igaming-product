-- migration: rename operator_id to brand_id in infrastructure tables
-- This ensures consistency across the entire schema after the user refactor.
DO $$ BEGIN -- 1. Rename column in tenant_configs
IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tenant_configs'
        AND column_name = 'operator_id'
) THEN
ALTER TABLE public.tenant_configs
    RENAME COLUMN operator_id TO brand_id;
END IF;
-- 2. Rename column in platform_audit_logs
IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'platform_audit_logs'
        AND column_name = 'operator_id'
) THEN
ALTER TABLE public.platform_audit_logs
    RENAME COLUMN operator_id TO brand_id;
END IF;
-- 3. Rename column in transactions
IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'transactions'
        AND column_name = 'operator_id'
) THEN
ALTER TABLE public.transactions
    RENAME COLUMN operator_id TO brand_id;
END IF;
-- 4. Rename column in transaction_locks
IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'transaction_locks'
        AND column_name = 'operator_id'
) THEN
ALTER TABLE public.transaction_locks
    RENAME COLUMN operator_id TO brand_id;
END IF;
END $$;