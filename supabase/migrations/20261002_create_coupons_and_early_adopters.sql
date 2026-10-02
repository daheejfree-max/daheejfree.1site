-- ==============================================================================
-- MIGRATION: COUPONS AND EARLY ADOPTER TRACKING (PRODUCTION READY)
-- File: supabase/migrations/20261002_create_coupons_and_early_adopters.sql
-- Run this directly in the Supabase SQL Editor: Dashboard -> SQL Editor -> New Query
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Ensure profiles table has subscription and early adopter columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_early_adopter BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_tier TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';

-- Index for fast lookup of early adopters
CREATE INDEX IF NOT EXISTS idx_profiles_is_early_adopter ON public.profiles (is_early_adopter) WHERE is_early_adopter = TRUE;

-- 3. Create coupons table if not exists
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

-- Index for case-insensitive lookup (PostgreSQL requires outer parentheses around expressions)
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons ((UPPER(code)));

-- 4. Enable Row Level Security (RLS) on coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated read access to active coupons
DROP POLICY IF EXISTS "Allow public read on active coupons" ON public.coupons;
CREATE POLICY "Allow public read on active coupons"
  ON public.coupons
  FOR SELECT
  USING (is_active = TRUE);

-- Allow service role full management on coupons
DROP POLICY IF EXISTS "Allow service role full management on coupons" ON public.coupons;
CREATE POLICY "Allow service role full management on coupons"
  ON public.coupons
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Grant appropriate permissions
GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT ALL ON public.coupons TO service_role;

-- 5. Seed initial promo coupons (Idempotent UPSERT)
INSERT INTO public.coupons (code, discount_percent, max_uses, used_count, tier_allowed, is_active)
VALUES
  ('SUNNAH100', 100, 100, 0, 'all', TRUE),
  ('EARLYBIRD', 100, 50, 0, 'all', TRUE),
  ('NIKAH100', 100, 30, 0, 'gold', TRUE),
  ('BARAKAH50', 50, 200, 0, 'all', TRUE),
  ('DAHEEJFREE20', 20, 500, 0, 'all', TRUE)
ON CONFLICT (code) DO UPDATE
SET 
  discount_percent = EXCLUDED.discount_percent,
  max_uses = EXCLUDED.max_uses,
  tier_allowed = EXCLUDED.tier_allowed,
  is_active = EXCLUDED.is_active;

-- 6. Helper RPC function to get early adopter count bypassing any profile RLS
CREATE OR REPLACE FUNCTION public.get_early_adopter_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.profiles WHERE is_early_adopter = TRUE;
$$;

GRANT EXECUTE ON FUNCTION public.get_early_adopter_count() TO anon, authenticated, service_role;

