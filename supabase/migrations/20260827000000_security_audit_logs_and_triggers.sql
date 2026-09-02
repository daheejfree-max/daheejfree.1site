-- ==============================================================================
-- MIGRATION: 100% Idempotent Schema Upgrades, Security Audit Logs & Deletion Archive
-- Run in Supabase SQL Editor or apply via Supabase CLI
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: DEFENSIVE PROFILE TABLE UPGRADES (IF NOT EXISTS / DO BLOCKS)
-- Safely add all required discovery, auditing, verification, and Wali columns
-- ------------------------------------------------------------------------------
DO $$ 
BEGIN
    -- Ensure profiles table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        -- Add is_active safely
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

        -- Add is_verified safely
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

        -- Add kyc_status safely
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'unverified';

        -- Add dowry_pledge_signed safely
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS dowry_pledge_signed BOOLEAN DEFAULT false;

        -- Add membership_tier safely
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS membership_tier TEXT DEFAULT 'free';

        -- Add last_known_ip safely
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS last_known_ip TEXT DEFAULT NULL;

        -- Add has_wali & wali_contact_number safely
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS has_wali BOOLEAN DEFAULT false;

        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS wali_contact_number TEXT DEFAULT NULL;

        -- Add sect & preferred_sect safely
        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS sect TEXT DEFAULT NULL;

        ALTER TABLE public.profiles 
        ADD COLUMN IF NOT EXISTS preferred_sect TEXT DEFAULT NULL;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- STEP 2: DEFENSIVE PHOTO & MATCH REQUEST TABLES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.photo_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.match_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- STEP 3: HIGH-PERFORMANCE DISCOVERY INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_discovery 
    ON public.profiles(gender, is_active, is_verified);

CREATE INDEX IF NOT EXISTS idx_photo_requests_lookup 
    ON public.photo_requests(requester_id, target_id, status);

CREATE INDEX IF NOT EXISTS idx_match_requests_lookup 
    ON public.match_requests(sender_id, target_id, status);

-- ------------------------------------------------------------------------------
-- STEP 4: STANDALONE SECURITY AUDIT LOGGING TABLE
-- Persists IP audit trails, security events, and archived deleted accounts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    last_known_ip TEXT,
    action_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize index for lookups by user and timestamp
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id 
    ON public.security_audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_action_type 
    ON public.security_audit_logs(action_type);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_recorded_at 
    ON public.security_audit_logs(recorded_at DESC);

-- Enable Row Level Security (RLS) across tables
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies:
-- 1. Service role retains full read/write access
DROP POLICY IF EXISTS "security_audit_logs_service_role" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_service_role" 
    ON public.security_audit_logs 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);

-- 2. Authenticated users can view only their own audit history
DROP POLICY IF EXISTS "security_audit_logs_read_own" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_read_own" 
    ON public.security_audit_logs 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

-- 3. Authenticated and anon can insert security audit records
DROP POLICY IF EXISTS "security_audit_logs_insert" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_insert" 
    ON public.security_audit_logs 
    FOR INSERT 
    TO authenticated, anon 
    WITH CHECK (true);

-- 4. Photo requests RLS
DROP POLICY IF EXISTS "photo_requests_read_involved" ON public.photo_requests;
CREATE POLICY "photo_requests_read_involved" 
    ON public.photo_requests 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = requester_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "photo_requests_insert_own" ON public.photo_requests;
CREATE POLICY "photo_requests_insert_own" 
    ON public.photo_requests 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "photo_requests_update_target" ON public.photo_requests;
CREATE POLICY "photo_requests_update_target" 
    ON public.photo_requests 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = target_id);

-- 5. Match requests RLS
DROP POLICY IF EXISTS "match_requests_read_involved" ON public.match_requests;
CREATE POLICY "match_requests_read_involved" 
    ON public.match_requests 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = sender_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "match_requests_insert_own" ON public.match_requests;
CREATE POLICY "match_requests_insert_own" 
    ON public.match_requests 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "match_requests_update_target" ON public.match_requests;
CREATE POLICY "match_requests_update_target" 
    ON public.match_requests 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = target_id);

-- ------------------------------------------------------------------------------
-- STEP 5: SECURITY DEFINER TRIGGER FUNCTION FOR DELETION ARCHIVING
-- Captures last_known_ip and full row state before profile hard deletion
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_user_ip_on_delete()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Archive deleted profile snapshot and IP safely into security_audit_logs
    INSERT INTO public.security_audit_logs (
        user_id,
        last_known_ip,
        action_type,
        metadata,
        recorded_at
    ) VALUES (
        OLD.id,
        COALESCE(OLD.last_known_ip, 'Unknown'),
        'USER_ACCOUNT_DELETED',
        jsonb_build_object(
            'deleted_profile', to_jsonb(OLD),
            'deleted_at', NOW(),
            'last_known_ip', OLD.last_known_ip
        ),
        NOW()
    );

    RETURN OLD;
EXCEPTION
    WHEN OTHERS THEN
        -- Never block profile deletion if audit logging encounters a transient error
        RAISE WARNING 'archive_user_ip_on_delete encountered error: %', SQLERRM;
        RETURN OLD;
END;
$$;

-- ------------------------------------------------------------------------------
-- STEP 6: ATTACH TRIGGER TO PROFILES TABLE
-- Drops any prior trigger to prevent duplicate firing and re-attaches safely
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS tr_archive_user_ip ON public.profiles;

CREATE TRIGGER tr_archive_user_ip
    BEFORE DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.archive_user_ip_on_delete();

