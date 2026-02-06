-- Migration to sync Supabase Auth users with public.users table
-- This ensures when a user signs up via Supabase Auth, they get a row in public.users

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.created_at
  );

  -- Also create default user_settings
  INSERT INTO public.user_settings (user_id, savings_percentage, investments_percentage, currency)
  VALUES (
    NEW.id,
    40, -- default 40% savings
    60, -- default 60% investments
    'EUR'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger that fires when a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users (if any) into public.users
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- Backfill user_settings for existing users
INSERT INTO public.user_settings (user_id, savings_percentage, investments_percentage, currency)
SELECT id, 40, 60, 'EUR'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_settings)
ON CONFLICT DO NOTHING;
