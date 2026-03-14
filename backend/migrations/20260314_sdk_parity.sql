-- Migration to support user-facing SDK features: Favourites and Activity Tracking
-- Version: 20260314_sdk_parity

-- 1. User Favourites Table
CREATE TABLE IF NOT EXISTS public.user_favourites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    game_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, game_id)
);

-- 2. User Activity Table (Recently Played, etc.)
CREATE TABLE IF NOT EXISTS public.user_activity (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type text NOT NULL, -- e.g., 'game_launch', 'track-activity'
    game_id text,
    metadata jsonb DEFAULT '{}',
    timestamp timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Simple policies for authenticated access (PoC)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all user_favourites') THEN
        CREATE POLICY "Allow all user_favourites" ON public.user_favourites FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all user_activity') THEN
        CREATE POLICY "Allow all user_activity" ON public.user_activity FOR ALL USING (true);
    END IF;
END $$;
