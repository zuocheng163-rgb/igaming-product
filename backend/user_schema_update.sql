-- Migration script to sync users table schema
-- This script assumes the table "user_details" might exist and needs to be renamed OR the new schema should be applied to "users".
-- 1. Rename existing table if it exists as user_details
DO $$ BEGIN IF EXISTS (
    SELECT
    FROM pg_tables
    WHERE schemaname = 'public'
        AND tablename = 'user_details'
) THEN
ALTER TABLE public.user_details
    RENAME TO users;
END IF;
END $$;
-- 2. Ensure all columns exist and match the new schema
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS user_id text,
    ADD COLUMN IF NOT EXISTS address text,
    ADD COLUMN IF NOT EXISTS city text,
    ADD COLUMN IF NOT EXISTS postal_code text,
    ADD COLUMN IF NOT EXISTS language text null,
    ADD COLUMN IF NOT EXISTS mobile text null,
    ADD COLUMN IF NOT EXISTS mobile_prefix text null,
    ADD COLUMN IF NOT EXISTS sex text null,
    ADD COLUMN IF NOT EXISTS title text null,
    ADD COLUMN IF NOT EXISTS birth_date date null,
    ADD COLUMN IF NOT EXISTS is_blocked boolean default false,
    ADD COLUMN IF NOT EXISTS is_excluded boolean default false,
    ADD COLUMN IF NOT EXISTS market text null,
    ADD COLUMN IF NOT EXISTS roles text [] default '{}'::text [],
    ADD COLUMN IF NOT EXISTS registration_code text null,
    ADD COLUMN IF NOT EXISTS affiliate_reference text null,
    ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone null,
    ADD COLUMN IF NOT EXISTS ft_brand_name text null,
    ADD COLUMN IF NOT EXISTS ft_origin text null,
    ADD COLUMN IF NOT EXISTS ft_jwt_secret text null;
-- 3. Ensure constraints and defaults
ALTER TABLE public.users
ALTER COLUMN balance
SET DEFAULT 0;
ALTER TABLE public.users
ALTER COLUMN bonus_balance
SET DEFAULT 0;
ALTER TABLE public.users
ALTER COLUMN currency
SET DEFAULT 'EUR';
-- Note: In Supabase UI, make sure to enable RLS or adjust policies if renaming from user_details.