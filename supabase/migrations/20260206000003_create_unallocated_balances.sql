-- Create unallocated_balances table
CREATE TABLE IF NOT EXISTS unallocated_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  savings_unallocated NUMERIC(12, 2) NOT NULL DEFAULT 0,
  investments_unallocated NUMERIC(12, 2) NOT NULL DEFAULT 0,
  last_auto_applied TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_unallocated UNIQUE (user_id)
);

-- Create index
CREATE INDEX idx_unallocated_balances_user_id ON unallocated_balances(user_id);

-- Enable Row Level Security
ALTER TABLE unallocated_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own unallocated balances"
  ON unallocated_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own unallocated balances"
  ON unallocated_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own unallocated balances"
  ON unallocated_balances FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own unallocated balances"
  ON unallocated_balances FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_unallocated_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the update function
CREATE TRIGGER update_unallocated_balances_updated_at_trigger
  BEFORE UPDATE ON unallocated_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_unallocated_balances_updated_at();
