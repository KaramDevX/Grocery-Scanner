-- ================================================
-- MIGRATION 002: RLS POLICIES
-- Enables Row Level Security on all tables and
-- defines access policies for each table
-- Run after 001_schema.sql
-- ================================================


-- ================================================
-- ENABLE RLS ON ALL TABLES
-- ================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;


-- ================================================
-- PROFILES
-- Users can only read and edit their own profile
-- ================================================

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);


-- ================================================
-- HOUSEHOLDS
-- Members can read their household
-- Only admins can update it
-- Any authenticated user can create one (on signup)
-- ================================================

CREATE POLICY "Members can view their household members"
ON household_members FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can update their household"
ON households FOR UPDATE
USING (
  id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Authenticated users can create a household"
ON households FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);


-- ================================================
-- HOUSEHOLD MEMBERS
-- Members can see who else is in their household
-- Only admins can add or remove members
-- Users can remove themselves (leave household)
-- ================================================

CREATE POLICY "Members can view their household members"
ON household_members FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can add members"
ON household_members FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can remove members"
ON household_members FOR DELETE
USING (
  household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Users can remove themselves"
ON household_members FOR DELETE
USING (user_id = auth.uid());


-- ================================================
-- STORES
-- Global/shared table — any authenticated user can
-- read or create stores. Nobody can delete them.
-- ================================================

CREATE POLICY "Anyone can view stores"
ON stores FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create stores"
ON stores FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);


-- ================================================
-- CATEGORIES
-- Global read-only table managed by the developer
-- ================================================

CREATE POLICY "Anyone can view categories"
ON categories FOR SELECT
USING (auth.uid() IS NOT NULL);


-- ================================================
-- RECEIPTS
-- All household members can view and add receipts
-- Only the scanner or an admin can update/delete
-- ================================================

CREATE POLICY "Members can view household receipts"
ON receipts FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can add receipts"
ON receipts FOR INSERT
WITH CHECK (
  household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can update their own receipts"
ON receipts FOR UPDATE
USING (
  scanned_by = auth.uid()
  OR
  household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "Members can delete their own receipts"
ON receipts FOR DELETE
USING (
  scanned_by = auth.uid()
  OR
  household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);


-- ================================================
-- RECEIPT ITEMS
-- Access is inherited from the parent receipt
-- If you can see the receipt, you can see its items
-- ================================================

CREATE POLICY "Members can view receipt items"
ON receipt_items FOR SELECT
USING (
  receipt_id IN (
    SELECT id FROM receipts
    WHERE household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Members can insert receipt items"
ON receipt_items FOR INSERT
WITH CHECK (
  receipt_id IN (
    SELECT id FROM receipts
    WHERE household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Members can update receipt items"
ON receipt_items FOR UPDATE
USING (
  receipt_id IN (
    SELECT id FROM receipts
    WHERE household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid()
    )
  )
);


-- ================================================
-- PRODUCT RECOMMENDATIONS
-- Members can view and dismiss their recommendations
-- INSERT is handled by Edge Functions using the
-- service role key which bypasses RLS entirely
-- ================================================

CREATE POLICY "Members can view recommendations"
ON product_recommendations FOR SELECT
USING (
  household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Members can dismiss recommendations"
ON product_recommendations FOR UPDATE
USING (
  household_id IN (
    SELECT household_id FROM household_members
    WHERE user_id = auth.uid()
  )
);
