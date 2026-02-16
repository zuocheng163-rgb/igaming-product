-- Migration to add status column to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Success';
-- Update index for status-based filtering
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);