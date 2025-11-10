-- Add email verification columns to users table
-- Migration for email verification feature

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS email_verification_token_expires_at TIMESTAMP;

-- Create index on verification token for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token 
ON users(email_verification_token) 
WHERE email_verification_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.email_verification_token IS 'Single-use token for email verification, expires after 24 hours';
COMMENT ON COLUMN users.email_verification_token_expires_at IS 'Expiration timestamp for the verification token';
