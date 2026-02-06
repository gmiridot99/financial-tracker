-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  savings_percentage INTEGER DEFAULT 40 CHECK (savings_percentage >= 0 AND savings_percentage <= 100),
  investments_percentage INTEGER DEFAULT 60 CHECK (investments_percentage >= 0 AND investments_percentage <= 100),
  currency TEXT DEFAULT 'EUR',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- Add constraint to ensure savings + investments = 100
ALTER TABLE user_settings
  ADD CONSTRAINT check_percentage_sum
  CHECK (savings_percentage + investments_percentage = 100);
