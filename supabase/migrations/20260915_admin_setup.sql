-- ==============================================================================
-- DAHEEJFREE MATRIMONIAL PLATFORM - GOD MODE ADMIN & ROLE ELEVATION SCRIPT
-- ==============================================================================
-- Execute this query in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

-- 1. Ensure required columns exist on public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';

-- 2. Create index on is_admin for fast role verification in RLS & Admin checks
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- 3. Elevate designated admin accounts via auth.users email lookup
UPDATE public.profiles
SET 
  is_admin = true,
  is_active = true,
  updated_at = NOW()
WHERE id IN (
  SELECT id 
  FROM auth.users 
  WHERE email IN ('behumble7860@gmail.com', 'hasnainkhan3177@gmail.com')
);

-- 4. Verification Check: View elevated administrators
SELECT 
  p.id,
  u.email,
  p.full_name,
  p.is_admin,
  p.is_active,
  p.kyc_status,
  p.kyc_verified,
  p.subscription_tier,
  p.updated_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.is_admin = true;
