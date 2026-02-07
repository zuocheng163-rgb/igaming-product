-- migration: dismantle users into users, user_consents, user_blocks
-- This script creates the new enterprise-grade schema for Fast Track integration.
-- 0. Cleanup old tables to ensure fresh schema (REQUIRED for brand_id column sync)
DROP TABLE IF EXISTS public.user_blocks CASCADE;
DROP TABLE IF EXISTS public.user_consents CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
-- 1. Create Users Table
CREATE TABLE public.users (
    brand_id integer NOT NULL,
    user_id text NOT NULL,
    id uuid DEFAULT gen_random_uuid(),
    -- Unified internal unique ID
    username text,
    first_name text,
    last_name text,
    email text,
    balance numeric DEFAULT 0,
    bonus_balance numeric DEFAULT 0,
    currency char(3) DEFAULT 'EUR',
    registration_date timestamp with time zone DEFAULT now(),
    verified_at timestamp with time zone,
    birth_date date,
    sex text,
    -- 'male', 'female', 'other'
    title text,
    language varchar(10),
    country varchar(64),
    city varchar(64),
    address text,
    postal_code varchar(16),
    mobile text,
    mobile_prefix varchar(6),
    full_mobile_number text,
    origin text,
    market text,
    registration_code text,
    affiliate_reference text,
    is_blocked boolean DEFAULT false,
    is_excluded boolean DEFAULT false,
    is_enabled boolean DEFAULT true,
    roles text [] DEFAULT '{PLAYER}',
    tags text,
    token text,
    last_modified timestamp with time zone DEFAULT now(),
    -- Composite Primary Key as requested (brand_id, user_id)
    CONSTRAINT users_pkey PRIMARY KEY (brand_id, user_id),
    CONSTRAINT users_id_key UNIQUE (id)
);
-- 2. Create User Consents Table
CREATE TABLE public.user_consents (
    brand_id integer NOT NULL,
    user_id text NOT NULL,
    allow_marketing_communication boolean DEFAULT true,
    email boolean DEFAULT true,
    sms boolean DEFAULT true,
    telephone boolean DEFAULT true,
    post_mail boolean DEFAULT true,
    site_notification boolean DEFAULT true,
    push_notification boolean DEFAULT true,
    global_communication_excluded boolean DEFAULT false,
    global_communication_exclusion_date timestamp with time zone,
    last_modified timestamp with time zone DEFAULT now(),
    -- Individual products (JSON or Text)
    email_products text,
    sms_products text,
    telephone_products text,
    post_mail_products text,
    site_notification_products text,
    push_notification_products text,
    CONSTRAINT user_consents_pkey PRIMARY KEY (brand_id, user_id),
    CONSTRAINT fk_user FOREIGN KEY (brand_id, user_id) REFERENCES public.users(brand_id, user_id) ON DELETE CASCADE
);
-- 3. Create User Blocks Table
CREATE TABLE public.user_blocks (
    brand_id integer NOT NULL,
    user_id text NOT NULL,
    blocked boolean DEFAULT false,
    excluded boolean DEFAULT false,
    last_modified timestamp with time zone DEFAULT now(),
    CONSTRAINT user_blocks_pkey PRIMARY KEY (brand_id, user_id),
    CONSTRAINT fk_user_blocks FOREIGN KEY (brand_id, user_id) REFERENCES public.users(brand_id, user_id) ON DELETE CASCADE
);
-- Index for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_consents_modified ON public.user_consents(last_modified);
CREATE INDEX IF NOT EXISTS idx_blocks_status ON public.user_blocks(blocked, excluded);
-- Trigger to update last_modified
CREATE OR REPLACE FUNCTION update_last_modified() RETURNS TRIGGER AS $$ BEGIN NEW.last_modified = now();
RETURN NEW;
END;
$$ language 'plpgsql';
CREATE TRIGGER tr_users_modified BEFORE
UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_last_modified();
CREATE TRIGGER tr_consents_modified BEFORE
UPDATE ON public.user_consents FOR EACH ROW EXECUTE FUNCTION update_last_modified();
CREATE TRIGGER tr_blocks_modified BEFORE
UPDATE ON public.user_blocks FOR EACH ROW EXECUTE FUNCTION update_last_modified();