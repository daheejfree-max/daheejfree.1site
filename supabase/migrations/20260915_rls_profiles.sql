-- ==============================================================================
-- PILLAR 1: ABSOLUTE DATABASE SECURITY & ROW LEVEL SECURITY (public.profiles)
-- ==============================================================================

-- 1. Enable Row Level Security on public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing conflicting policies to establish a clean, deterministic state
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can do anything" ON public.profiles;
DROP POLICY IF EXISTS "Select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access" ON public.profiles;
DROP POLICY IF EXISTS "Admins can SELECT all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can UPDATE all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can ALL profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;

-- 3. Helper function with SECURITY DEFINER to check if the caller is an active admin
-- Bypasses RLS recursion when checking the caller's admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- 4. Policy: Users can SELECT ONLY their own row (auth.uid() = id)
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 5. Policy: Users can UPDATE ONLY their own row (auth.uid() = id)
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  -- Prevent privilege escalation: non-admin users cannot alter is_admin
  AND (is_admin IS NOT TRUE OR public.is_admin() = true)
);

-- 6. Overriding Policy: Admins can SELECT ALL rows
CREATE POLICY "profiles_admin_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin() = true);

-- 7. Overriding Policy: Admins can UPDATE ALL rows
CREATE POLICY "profiles_admin_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin() = true)
WITH CHECK (public.is_admin() = true);

-- 8. Grant appropriate permissions to authenticated users
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
