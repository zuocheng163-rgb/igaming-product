-- Add config column to tenant_configs for storing dynamic operator settings
ALTER TABLE public.tenant_configs
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
-- Optional: If you want to migrate any existing keys into the config object
-- UPDATE public.tenant_configs 
-- SET config = jsonb_build_object('operator_api_key', ft_api_key)
-- WHERE ft_api_key IS NOT NULL;