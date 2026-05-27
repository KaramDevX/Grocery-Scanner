-- ================================================
-- MIGRATION 003: TRIGGERS AND FUNCTIONS
-- Sets up automatic profile + household creation
-- on signup, and the join household by code function
-- Run after 002_rls_policies.sql
-- ================================================


-- ================================================
-- HELPER FUNCTION: generate a short invite code
-- Produces a 6-character code e.g. "X7K2P9"
-- Characters chosen to avoid ambiguous ones (0/O, 1/I)
-- ================================================

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;


-- ================================================
-- MAIN FUNCTION: runs automatically on every signup
-- Creates profile, household, and membership in one go
--
-- Reads from user metadata passed at signup:
--   full_name       - user's display name
--   household_type  - 'solo' or 'household'
--   household_name  - e.g. "The Johnsons" or "My Finances"
-- ================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_household_id UUID;
  new_invite_code TEXT;
  household_type TEXT;
  household_name TEXT;
BEGIN
  -- Read what the user chose during onboarding
  household_type := COALESCE(NEW.raw_user_meta_data->>'household_type', 'solo');
  household_name := COALESCE(NEW.raw_user_meta_data->>'household_name', 'My Finances');

  -- 1. Create the profile
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );

  -- 2. Generate a unique invite code
  new_invite_code := public.generate_invite_code();

  -- 3. Create their household
  INSERT INTO public.households (name, type, invite_code)
  VALUES (household_name, household_type, new_invite_code)
  RETURNING id INTO new_household_id;

  -- 4. Add the user as admin of that household
  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (new_household_id, NEW.id, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ================================================
-- ATTACH THE TRIGGER TO auth.users
-- Fires after every new user row is inserted
-- ================================================

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- ================================================
-- FUNCTION: join an existing household by invite code
-- Called from the frontend via supabase.rpc()
--
-- Usage from frontend:
--   const { data } = await supabase.rpc('join_household_by_code', {
--     code: 'X7K2P9'
--   });
--
-- What it does:
--   1. Finds the household with the given invite code
--   2. Moves the user into that household as a member
--   3. Deletes the placeholder household auto-created at signup
-- ================================================

CREATE OR REPLACE FUNCTION join_household_by_code(code TEXT)
RETURNS UUID AS $$
DECLARE
  target_household_id UUID;
  current_household_id UUID;
BEGIN
  -- Find the household with this invite code
  SELECT id INTO target_household_id
  FROM households
  WHERE invite_code = UPPER(code);

  IF target_household_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Find the user's current auto-created placeholder household
  SELECT household_id INTO current_household_id
  FROM household_members
  WHERE user_id = auth.uid();

  -- Add user to the target household (or update if already in one)
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (target_household_id, auth.uid(), 'member')
  ON CONFLICT (user_id) DO UPDATE
    SET household_id = target_household_id,
        role = 'member';

  -- Clean up the old placeholder household
  DELETE FROM households
  WHERE id = current_household_id;

  RETURN target_household_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


