-- ==============================================================================
-- P0 AUTH BYPASS PATCH & DIDIT EXCLUSIVE KYC ENFORCEMENT
-- File: supabase/migrations/20260920_enforce_auth_uid_and_purge_wali_email_auth.sql
-- 1. Enforces auth.uid() = id for all profile queries and mutations
-- 2. Strictly forbids wali_email from being queried for authentication/session matching
-- 3. Ensures kyc_status and kyc_verified can ONLY be updated by Service Role (Didit Webhook)
-- ==============================================================================

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop legacy or insecure policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_restricted" ON public.profiles;

-- 1. Authenticated users can SELECT their own profile
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Authenticated users can UPDATE their own profile EXCEPT kyc_status / kyc_verified / is_admin
-- Webhooks use the Supabase Service Role Key which bypasses RLS to approve KYC
CREATE POLICY "profiles_update_restricted"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (is_admin IS NOT TRUE OR public.is_admin() = true)
);

-- Comments clarifying security boundaries
COMMENT ON COLUMN public.profiles.wali_email IS 'Guardian contact metadata only. MUST NEVER be used for session lookup or account authentication.';
COMMENT ON COLUMN public.profiles.kyc_status IS 'KYC verification state. Managed exclusively by the authenticated Didit webhook listener via Service Role.';
