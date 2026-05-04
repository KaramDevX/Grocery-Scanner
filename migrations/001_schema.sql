-- ================================================
-- MIGRATION 001: SCHEMA
-- Creates all 8 tables for the receipt tracking app
-- Run this first before any other migration
-- ================================================


-- 1. Profiles (mirrors auth.users)
CREATE TABLE profiles (
  id            UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name     TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- 2. Households
CREATE TABLE households (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT DEFAULT 'solo',      -- 'solo' or 'household'
  invite_code   TEXT UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- 3. Household members
CREATE TABLE household_members (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT DEFAULT 'member',    -- 'admin' or 'member'
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);


-- 4. Stores
CREATE TABLE stores (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  country       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, country)
);


-- 5. Categories
CREATE TABLE categories (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  icon          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);


-- 6. Receipts
CREATE TABLE receipts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE,
  scanned_by      UUID REFERENCES auth.users(id),
  store_id        UUID REFERENCES stores(id),
  purchased_at    TIMESTAMPTZ NOT NULL,
  total_amount    DECIMAL(10,2) NOT NULL,
  currency        TEXT DEFAULT 'EUR',
  country         TEXT,
  image_url       TEXT,
  status          TEXT DEFAULT 'pending', -- 'pending', 'processed', 'confirmed'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- 7. Receipt items
CREATE TABLE receipt_items (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id            UUID REFERENCES receipts(id) ON DELETE CASCADE,
  category_id           UUID REFERENCES categories(id),
  product_name          TEXT NOT NULL,
  brand_name            TEXT,
  weight_volume         TEXT,
  unit_of_measurement   TEXT,
  total_units           DECIMAL(10,3),
  quantity              INTEGER DEFAULT 1,
  unit_price            DECIMAL(10,2) NOT NULL,
  total_price           DECIMAL(10,2) NOT NULL,
  price_per_unit        DECIMAL(10,4),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);


-- 8. Product recommendations
CREATE TABLE product_recommendations (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id              UUID REFERENCES households(id) ON DELETE CASCADE,
  receipt_item_id           UUID REFERENCES receipt_items(id) ON DELETE CASCADE,
  original_product          TEXT NOT NULL,
  original_price            DECIMAL(10,2),
  original_price_per_unit   DECIMAL(10,4),
  recommended_product       TEXT NOT NULL,
  recommended_store         TEXT,
  estimated_price           DECIMAL(10,2),
  estimated_price_per_unit  DECIMAL(10,4),
  estimated_saving          DECIMAL(10,2),
  recommendation_type       TEXT,           -- 'better_value' or 'healthier'
  reason                    TEXT,
  generated_at              TIMESTAMPTZ DEFAULT NOW(),
  dismissed_at              TIMESTAMPTZ
);


-- ================================================
-- SEED: Pre-populate categories
-- ================================================

INSERT INTO categories (name, icon) VALUES
  ('Dairy', '🥛'),
  ('Meat & Fish', '🥩'),
  ('Fruit & Vegetables', '🥦'),
  ('Bakery', '🍞'),
  ('Snacks', '🍫'),
  ('Frozen', '🧊'),
  ('Drinks', '🥤'),
  ('Pantry', '🫙'),
  ('Cleaning', '🧹'),
  ('Personal Care', '🧴'),
  ('Baby & Toddler', '🍼'),
  ('Pet Care', '🐾'),
  ('Other', '🛒');
