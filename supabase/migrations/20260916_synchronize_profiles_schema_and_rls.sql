-- ==============================================================================
-- STEP 1: DATABASE TRUTH & SYNCHRONIZATION SCRIPT (EXECUTE IN SUPABASE SQL EDITOR)
-- ==============================================================================

-- 1. Ensure columns exist with correct types and non-null defaults
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status text DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';

-- 2. Clean existing rows of any NULL values for these critical flags
UPDATE public.profiles SET is_admin = false WHERE is_admin IS NULL;
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;
UPDATE public.profiles SET kyc_verified = false WHERE kyc_verified IS NULL;
UPDATE public.profiles SET kyc_status = 'pending' WHERE kyc_status IS NULL;
UPDATE public.profiles SET subscription_tier = 'free' WHERE subscription_tier IS NULL;

-- 3. Enforce default constraints
ALTER TABLE public.profiles ALTER COLUMN is_admin SET DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE public.profiles ALTER COLUMN kyc_verified SET DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN kyc_status SET DEFAULT 'pending';
ALTER TABLE public.profiles ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- 4. Enable Row Level Security (RLS) on public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Drop any prior conflicting policies to avoid policy collisions
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do anything" ON public.profiles;
DROP POLICY IF EXISTS "Select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access" ON public.profiles;

-- 6. Helper function with SECURITY DEFINER to bypass RLS recursion when testing admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$;

-- 7. Policy: Users can SELECT their own profile row
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 8. Policy: Users can UPDATE their own profile row
-- Prevents privilege escalation: non-admins cannot toggle is_admin = true
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND (is_admin IS NOT TRUE OR public.is_admin() = true)
);

-- 9. Policy: Admins have full SELECT access to ALL profiles
CREATE POLICY "profiles_admin_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin() = true);

-- 10. Policy: Admins have full UPDATE access to ALL profiles
CREATE POLICY "profiles_admin_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin() = true)
WITH CHECK (public.is_admin() = true);

-- 11. Grant appropriate permissions to authenticated role
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- 12. Update designated emails to is_admin = true in public.profiles
-- Match via email column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    UPDATE public.profiles
    SET is_admin = true
    WHERE LOWER(TRIM(email)) IN ('hasnainkhan3177@gmail.com', 'behumble7860@gmail.com');
  END IF;
END $$;

-- Also match via wali_email if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'wali_email'
  ) THEN
    UPDATE public.profiles
    SET is_admin = true
    WHERE LOWER(TRIM(wali_email)) IN ('hasnainkhan3177@gmail.com', 'behumble7860@gmail.com');
  END IF;
END $$;

-- Match via auth.users id mapping to public.profiles id
UPDATE public.profiles
SET is_admin = true
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE LOWER(TRIM(email)) IN ('hasnainkhan3177@gmail.com', 'behumble7860@gmail.com')
);

-- Verification Query (Run this to verify admins are set)
SELECT id, is_admin, is_active, kyc_verified, kyc_status, subscription_tier 
FROM public.profiles 
WHERE is_admin = true;
