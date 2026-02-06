-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Create index on type for filtering
CREATE INDEX idx_categories_type ON categories(type);

-- Seed default income categories
INSERT INTO categories (user_id, name, type, is_default) VALUES
  (NULL, 'Stipendio', 'income', true),
  (NULL, 'Freelance', 'income', true),
  (NULL, 'Bonus', 'income', true),
  (NULL, 'Investimenti (dividendi)', 'income', true),
  (NULL, 'Altro', 'income', true);

-- Seed default expense categories
INSERT INTO categories (user_id, name, type, is_default) VALUES
  (NULL, 'Affitto/Mutuo', 'expense', true),
  (NULL, 'Utenze', 'expense', true),
  (NULL, 'Cibo', 'expense', true),
  (NULL, 'Trasporti', 'expense', true),
  (NULL, 'Salute', 'expense', true),
  (NULL, 'Abbonamenti', 'expense', true),
  (NULL, 'Intrattenimento', 'expense', true),
  (NULL, 'Shopping', 'expense', true),
  (NULL, 'Viaggi', 'expense', true),
  (NULL, 'Altro', 'expense', true);
