ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert profiles"
ON profiles FOR INSERT
WITH CHECK (true);


DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (true);