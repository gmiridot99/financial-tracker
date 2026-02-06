-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'EUR',
  category UUID NOT NULL REFERENCES categories(id),
  is_recurring BOOLEAN DEFAULT false,
  frequency TEXT DEFAULT 'one-time' CHECK (frequency IN ('monthly', 'annual', 'one-time')),
  start_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster user queries
CREATE INDEX idx_transactions_user_id ON transactions(user_id);

-- Create index on start_date for date-based queries
CREATE INDEX idx_transactions_start_date ON transactions(start_date);

-- Create composite index on user_id and start_date for optimal query performance
CREATE INDEX idx_transactions_user_id_start_date ON transactions(user_id, start_date);

-- Create index on category for category-based queries
CREATE INDEX idx_transactions_category ON transactions(category);

-- Create index on type for filtering income/expense
CREATE INDEX idx_transactions_type ON transactions(type);

-- Create index on is_recurring for filtering recurring transactions
CREATE INDEX idx_transactions_is_recurring ON transactions(is_recurring);
