-- Migration: Add performance indexes and last_login column
-- Date: 2026-02-15
-- Purpose: Support efficient filtering and pagination for 100K+ records
-- Add last_login column to users table if it doesn't exist
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'last_login'
) THEN
ALTER TABLE public.users
ADD COLUMN last_login timestamp with time zone;
END IF;
END $$;
-- Create indexes for efficient filtering and sorting
CREATE INDEX IF NOT EXISTS idx_users_country ON public.users(country);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON public.users(last_login DESC);
CREATE INDEX IF NOT EXISTS idx_users_balance ON public.users(balance);
CREATE INDEX IF NOT EXISTS idx_users_username_search ON public.users(username text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_search ON public.users(email text_pattern_ops);
-- Indexes for transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_amount ON public.transactions(amount);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
-- Indexes for audit logs (operational stream)
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.platform_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_brand_id ON public.platform_audit_logs(brand_id);
-- Comment for documentation
COMMENT ON INDEX idx_users_last_login IS 'Supports sorting by last login for player management';
COMMENT ON INDEX idx_users_balance IS 'Supports balance range filtering';
COMMENT ON INDEX idx_transactions_created_at IS 'Supports transaction date filtering and sorting';