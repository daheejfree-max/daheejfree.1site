-- ==============================================================================
-- MIGRATION: 20260916_legal_consent_columns_and_trigger.sql
-- PURPOSE: Guarantee exact boolean columns for legal consent and audit trigger
-- COLUMNS: terms_accepted, privacy_policy_accepted, anti_dowry_pledged
-- ==============================================================================

-- 1. Ensure columns exist with boolean type and NOT NULL default false
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS anti_dowry_pledged BOOLEAN NOT NULL DEFAULT false;

-- Backfill any existing null values to false
UPDATE public.profiles
SET 
  terms_accepted = COALESCE(terms_accepted, false),
  privacy_policy_accepted = COALESCE(privacy_policy_accepted, false),
  anti_dowry_pledged = COALESCE(anti_dowry_pledged, false)
WHERE terms_accepted IS NULL 
   OR privacy_policy_accepted IS NULL 
   OR anti_dowry_pledged IS NULL;

-- 2. Audit & Update handle_new_user() Auth Trigger Function
-- Ensures new signups NEVER insert NULL for legal consent columns.
-- Defaults them to false unless explicitly present in raw_user_meta_data.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_consent_timestamp TIMESTAMPTZ;
  v_terms BOOLEAN;
  v_privacy BOOLEAN;
  v_anti_dowry BOOLEAN;
BEGIN
  -- Read consent flags from raw_user_meta_data if present, else default strictly to false
  v_terms := COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::boolean, false);
  v_privacy := COALESCE((NEW.raw_user_meta_data->>'privacy_policy_accepted')::boolean, false);
  v_anti_dowry := COALESCE((NEW.raw_user_meta_data->>'anti_dowry_pledged')::boolean, false);

  IF v_terms AND v_privacy AND v_anti_dowry THEN
    v_consent_timestamp := COALESCE((NEW.raw_user_meta_data->>'legal_consent_accepted_at')::TIMESTAMPTZ, now());
  ELSE
    v_consent_timestamp := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    gender,
    avatar_url,
    phone_number,
    location,
    city,
    profession,
    wali_name,
    wali_relation,
    wali_phone,
    wali_email,
    kyc_status,
    subscription_tier,
    membership_tier,
    is_active,
    is_onboarded,
    terms_accepted,
    privacy_policy_accepted,
    anti_dowry_pledged,
    legal_consent_accepted_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Matrimonial Candidate'),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'female'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE(NEW.raw_user_meta_data->>'location', 'Hyderabad, TS'),
    COALESCE(NEW.raw_user_meta_data->>'city', 'Hyderabad, TS'),
    COALESCE(NEW.raw_user_meta_data->>'profession', 'Working Professional'),
    COALESCE(NEW.raw_user_meta_data->>'wali_name', 'Guardian'),
    COALESCE(NEW.raw_user_meta_data->>'wali_relation', 'Father'),
    COALESCE(NEW.raw_user_meta_data->>'wali_phone', '+91 98765 43210'),
    COALESCE(NEW.raw_user_meta_data->>'wali_email', NEW.email),
    'unverified',
    'free',
    'free',
    true,
    false,
    v_terms,
    v_privacy,
    v_anti_dowry,
    v_consent_timestamp,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    terms_accepted = CASE WHEN EXCLUDED.terms_accepted THEN true ELSE public.profiles.terms_accepted END,
    privacy_policy_accepted = CASE WHEN EXCLUDED.privacy_policy_accepted THEN true ELSE public.profiles.privacy_policy_accepted END,
    anti_dowry_pledged = CASE WHEN EXCLUDED.anti_dowry_pledged THEN true ELSE public.profiles.anti_dowry_pledged END,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Ensure trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Reload PostgREST schema cache to immediately reflect column definitions
NOTIFY pgrst, 'reload schema';
