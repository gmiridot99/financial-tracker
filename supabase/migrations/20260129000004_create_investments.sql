-- Create investment_categories table
CREATE TABLE IF NOT EXISTS investment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  expected_return_rate NUMERIC(5, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_investment_categories_user_id ON investment_categories(user_id);

-- Create investment_allocations table
CREATE TABLE IF NOT EXISTS investment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2000),
  investment_category_id UUID NOT NULL REFERENCES investment_categories(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month, year, investment_category_id)
);

-- Create indexes for investment_allocations
CREATE INDEX idx_investment_allocations_user_id ON investment_allocations(user_id);
CREATE INDEX idx_investment_allocations_month_year ON investment_allocations(month, year);
CREATE INDEX idx_investment_allocations_user_id_month_year ON investment_allocations(user_id, month, year);
CREATE INDEX idx_investment_allocations_category_id ON investment_allocations(investment_category_id);

-- Seed default investment categories
INSERT INTO investment_categories (user_id, name, expected_return_rate) VALUES
  (NULL, 'Azioni', 7.00),
  (NULL, 'Obbligazioni', 3.00),
  (NULL, 'Liquidità', 1.00);
