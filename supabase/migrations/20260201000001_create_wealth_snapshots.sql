-- Create wealth_snapshots table for tracking monthly wealth status
CREATE TABLE IF NOT EXISTS wealth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  investments_balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (investments_balance >= 0),
  savings_balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (savings_balance >= 0),
  is_manual BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_year_month UNIQUE (user_id, year, month)
);

-- Create indexes for query optimization
CREATE INDEX idx_wealth_snapshots_user_id ON wealth_snapshots(user_id);
CREATE INDEX idx_wealth_snapshots_user_id_year ON wealth_snapshots(user_id, year);
CREATE INDEX idx_wealth_snapshots_user_id_year_month ON wealth_snapshots(user_id, year, month);

-- Enable Row Level Security
ALTER TABLE wealth_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own wealth snapshots
CREATE POLICY "Users can view their own wealth snapshots"
  ON wealth_snapshots
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own wealth snapshots
CREATE POLICY "Users can insert their own wealth snapshots"
  ON wealth_snapshots
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own wealth snapshots
CREATE POLICY "Users can update their own wealth snapshots"
  ON wealth_snapshots
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own wealth snapshots
CREATE POLICY "Users can delete their own wealth snapshots"
  ON wealth_snapshots
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wealth_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the update function
CREATE TRIGGER update_wealth_snapshots_updated_at_trigger
  BEFORE UPDATE ON wealth_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_wealth_snapshots_updated_at();
