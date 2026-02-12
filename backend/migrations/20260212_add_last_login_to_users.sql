-- Add last_login column to users table for active player tracking
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
-- Add index for performance in queries if needed (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);