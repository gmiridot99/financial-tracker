-- Create saved_simulations table for storing simulation configurations
CREATE TABLE IF NOT EXISTS saved_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 100),
  config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_simulation_name UNIQUE (user_id, name)
);

-- Create indexes for query optimization
CREATE INDEX idx_saved_simulations_user_id ON saved_simulations(user_id);
CREATE INDEX idx_saved_simulations_user_id_created ON saved_simulations(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_simulations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own saved simulations
CREATE POLICY "Users can view their own saved simulations"
  ON saved_simulations
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own saved simulations
CREATE POLICY "Users can insert their own saved simulations"
  ON saved_simulations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own saved simulations
CREATE POLICY "Users can update their own saved simulations"
  ON saved_simulations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own saved simulations
CREATE POLICY "Users can delete their own saved simulations"
  ON saved_simulations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_simulations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the update function
CREATE TRIGGER update_saved_simulations_updated_at_trigger
  BEFORE UPDATE ON saved_simulations
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_simulations_updated_at();
