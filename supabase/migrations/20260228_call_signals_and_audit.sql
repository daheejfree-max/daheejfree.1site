-- 1. Call Signals Table
CREATE TABLE IF NOT EXISTS public.call_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('offer', 'answer', 'ice-candidate', 'end-call', 'reject-call')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view and insert their own call signals"
  ON public.call_signals FOR ALL
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- 2. Database Atomic Account Deletion & Forensic Audit Log
CREATE TABLE IF NOT EXISTS public.account_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  deletion_ip TEXT,
  reason TEXT,
  profile_snapshot JSONB
);

-- Drop previous overloaded signatures to avoid parameter conflicts
DROP FUNCTION IF EXISTS public.delete_user_account(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.delete_user_account();
DROP FUNCTION IF EXISTS public.delete_user_account(TEXT);

CREATE OR REPLACE FUNCTION public.delete_user_account(p_reason TEXT DEFAULT 'User self-deletion')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_profile_snapshot JSONB;
  v_raw_ip TEXT;
  v_client_ip TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Zero-Trust IP Extraction from HTTP request headers
  BEGIN
    v_raw_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
    IF v_raw_ip IS NOT NULL AND v_raw_ip <> '' THEN
      v_client_ip := trim(split_part(v_raw_ip, ',', 1));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := NULL;
  END;

  IF v_client_ip IS NULL OR v_client_ip = '' THEN
    v_client_ip := '127.0.0.1';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT to_jsonb(p.*) INTO v_profile_snapshot FROM public.profiles p WHERE p.id = v_uid;

  -- 1. Audit Log
  INSERT INTO public.account_audit_logs (user_id, email, deletion_ip, reason, profile_snapshot)
  VALUES (v_uid, v_email, v_client_ip, COALESCE(p_reason, 'User self-deletion'), v_profile_snapshot);

  -- 2. Drop dependent rows (profiles might have cascaded, but explicit deletion is safe)
  DELETE FROM public.call_signals WHERE caller_id = v_uid OR receiver_id = v_uid;
  DELETE FROM public.photo_permissions WHERE grantor_id = v_uid OR grantee_id = v_uid;
  DELETE FROM public.matches WHERE user1_id = v_uid OR user2_id = v_uid;
  DELETE FROM public.profiles WHERE id = v_uid;

  -- 3. Execute Auth user deletion
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- Schema Hardening & Execution Locking
REVOKE EXECUTE ON FUNCTION public.delete_user_account(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(TEXT) TO authenticated;
