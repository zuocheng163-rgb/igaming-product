-- 1. Create Tenant Configurations table
CREATE TABLE IF NOT EXISTS public.tenant_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id TEXT UNIQUE NOT NULL,
    operator_name TEXT NOT NULL,
    ft_api_url TEXT,
    ft_api_key TEXT,
    platform_origin TEXT DEFAULT 'igaming-gateway',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2. Create Platform Audit Logs table
CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id UUID NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    level TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    metadata JSONB,
    status TEXT,
    operator_id TEXT,
    message TEXT
);
-- 3. Create User Details table (renamed from users)
CREATE TABLE IF NOT EXISTS public.user_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    token TEXT,
    balance DECIMAL(12, 2) DEFAULT 1000,
    bonus_balance DECIMAL(12, 2) DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    country TEXT DEFAULT 'MT',
    operator_id TEXT DEFAULT 'default-operator',
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 4. Create Transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT UNIQUE NOT NULL,
    operator_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES public.user_details(id),
    type TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency TEXT NOT NULL,
    game_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 5. Create Transaction Locks for Idempotency
CREATE TABLE IF NOT EXISTS public.transaction_locks (
    transaction_id TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 minute'
);
-- 6. Enable RLS & Policies
ALTER TABLE public.user_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_configs ENABLE ROW LEVEL SECURITY;
-- Simple permissive policies to allow backend maturity testing
CREATE POLICY "Enable all for user_details" ON public.user_details FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for audit_logs" ON public.platform_audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for tenant_configs" ON public.tenant_configs FOR ALL USING (true) WITH CHECK (true);