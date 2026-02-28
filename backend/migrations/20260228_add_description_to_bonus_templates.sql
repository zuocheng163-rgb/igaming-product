-- Migration: Add description column to bonus_templates
ALTER TABLE bonus_templates
ADD COLUMN IF NOT EXISTS description TEXT;