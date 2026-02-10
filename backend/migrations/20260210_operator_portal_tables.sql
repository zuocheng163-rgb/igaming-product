-- Migration for NeoStrike Operator Portal (Serverless Edition)
-- 1. Create operator_notifications table
CREATE TABLE IF NOT EXISTS public.operator_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id TEXT NOT NULL DEFAULT 'default-operator',
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'Warning', 'Info')),
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    entity_id TEXT,
    -- Reference to player (user_id) or transaction
    metadata JSONB DEFAULT '{}'
);
-- 2. Create daily_stats table for pre-aggregated GGR
CREATE TABLE IF NOT EXISTS public.daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id TEXT NOT NULL DEFAULT 'default-operator',
    date DATE NOT NULL,
    total_bets DECIMAL(18, 2) DEFAULT 0,
    total_wins DECIMAL(18, 2) DEFAULT 0,
    ggr DECIMAL(18, 2) DEFAULT 0,
    ngr DECIMAL(18, 2) DEFAULT 0,
    active_players INTEGER DEFAULT 0,
    approval_rate DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(operator_id, date)
);
-- 3. Enable RLS
ALTER TABLE public.operator_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
-- 4. Simple permissive policies
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Enable all for operator_notifications'
) THEN CREATE POLICY "Enable all for operator_notifications" ON public.operator_notifications FOR ALL USING (true) WITH CHECK (true);
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Enable all for daily_stats'
) THEN CREATE POLICY "Enable all for daily_stats" ON public.daily_stats FOR ALL USING (true) WITH CHECK (true);
END IF;
-- 5. Trigger to automatically log notifications for critical audit events
CREATE OR REPLACE FUNCTION public.fn_log_operator_notification() RETURNS TRIGGER AS $$ BEGIN IF NEW.level = 'error'
    OR NEW.status = 'failed' THEN
INSERT INTO public.operator_notifications (
        operator_id,
        type,
        message,
        severity,
        entity_id,
        metadata
    )
VALUES (
        COALESCE(NEW.operator_id, 'default-operator'),
        NEW.action,
        COALESCE(NEW.message, 'An operational error occurred'),
        CASE
            WHEN NEW.level = 'error' THEN 'Critical'
            ELSE 'Warning'
        END,
        NEW.entity_id,
        NEW.metadata
    );
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS tr_audit_to_notification ON public.platform_audit_logs;
CREATE TRIGGER tr_audit_to_notification
AFTER
INSERT ON public.platform_audit_logs FOR EACH ROW EXECUTE FUNCTION public.fn_log_operator_notification();