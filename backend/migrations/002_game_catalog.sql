-- 1. Create Game Master Table (Shared Metadata)
CREATE TABLE IF NOT EXISTS public.games_master (
    id TEXT PRIMARY KEY,
    -- e.g. "evolution:lightning-roulette"
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    thumbnail TEXT,
    rtp DECIMAL(5, 2),
    min_bet DECIMAL(12, 2),
    max_bet DECIMAL(12, 2),
    has_demo BOOLEAN DEFAULT FALSE,
    tags JSONB DEFAULT '[]',
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2. Create Tenant Game Config Table (Per-Tenant Overrides)
CREATE TABLE IF NOT EXISTS public.tenant_game_config (
    brand_id TEXT NOT NULL,
    -- using brand_id to match tenant portal schema
    game_id TEXT NOT NULL REFERENCES public.games_master(id),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (brand_id, game_id)
);
-- 3. Create Sync Log Table
CREATE TABLE IF NOT EXISTS public.game_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id TEXT,
    provider TEXT NOT NULL,
    games_added INTEGER DEFAULT 0,
    games_updated INTEGER DEFAULT 0,
    duration_ms INTEGER,
    status TEXT NOT NULL,
    error_message TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
-- 4. Enable RLS
ALTER TABLE public.games_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_game_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sync_logs ENABLE ROW LEVEL SECURITY;
-- 5. Policies
CREATE POLICY "Enable read for all on games_master" ON public.games_master FOR
SELECT USING (true);
CREATE POLICY "Enable all for tenant_game_config" ON public.tenant_game_config FOR ALL USING (true);
CREATE POLICY "Enable all for game_sync_logs" ON public.game_sync_logs FOR ALL USING (true);