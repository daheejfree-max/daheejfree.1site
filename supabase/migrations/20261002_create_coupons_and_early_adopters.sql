-- ==============================================================================
-- MIGRATION: COUPONS AND EARLY ADOPTER TRACKING
-- File: supabase/migrations/20261002_create_coupons_and_early_adopters.sql
-- ==============================================================================

-- 1. Ensure `is_early_adopter` column exists on profiles table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_early_adopter'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_early_adopter BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added is_early_adopter column to profiles table.';
  END IF;
END $$;

-- 2. Create coupons table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_uses INTEGER NOT NULL DEFAULT 100,
  used_count INTEGER NOT NULL DEFAULT 0,
  tier_allowed TEXT NOT NULL DEFAULT 'all' CHECK (tier_allowed IN ('gold', 'diamond', 'all')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast coupon lookup by code
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons (UPPER(code));

-- 3. Enable Row Level Security (RLS) on coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anon users to read active coupons
DROP POLICY IF EXISTS "Allow public read on active coupons" ON public.coupons;
CREATE POLICY "Allow public read on active coupons"
  ON public.coupons
  FOR SELECT
  USING (is_active = true);

-- Allow service role full management
DROP POLICY IF EXISTS "Allow service role full management on coupons" ON public.coupons;
CREATE POLICY "Allow service role full management on coupons"
  ON public.coupons
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Seed initial default promo coupons
INSERT INTO public.coupons (code, discount_percent, max_uses, used_count, tier_allowed, is_active)
VALUES
  ('SUNNAH100', 100, 100, 0, 'all', true),
  ('EARLYBIRD', 100, 50, 0, 'all', true),
  ('NIKAH100', 100, 30, 0, 'gold', true),
  ('BARAKAH50', 50, 200, 0, 'all', true),
  ('DAHEEJFREE20', 20, 500, 0, 'all', true)
ON CONFLICT (code) DO UPDATE
SET 
  discount_percent = EXCLUDED.discount_percent,
  tier_allowed = EXCLUDED.tier_allowed,
  is_active = EXCLUDED.is_active;
