-- ==============================================================================
-- DAHEEJFREE CONSOLIDATED MASTER SUPABASE DATABASE FIX & MIGRATION
-- 100% Idempotent, Safe to Run on Fresh or Existing Supabase Projects
-- Run directly in the Supabase SQL Editor (Dashboard > SQL Editor > New query > Run)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS SETUP
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. CORE PROFILES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    gender TEXT,
    age INTEGER,
    city TEXT,
    location TEXT,
    state TEXT,
    profession TEXT,
    education TEXT,
    sect TEXT,
    preferred_sect TEXT,
    prayer_frequency TEXT,
    covenant_signed BOOLEAN DEFAULT false,
    dowry_pledge_signed BOOLEAN DEFAULT false,
    anti_dowry_pledged BOOLEAN DEFAULT false,
    islamic_oath_signed BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    kyc_status TEXT DEFAULT 'unverified',
    selfie_verified BOOLEAN DEFAULT false,
    selfie_url TEXT,
    is_active BOOLEAN DEFAULT true,
    subscription_tier TEXT DEFAULT 'free',
    membership_tier TEXT DEFAULT 'free',
    last_known_ip TEXT DEFAULT NULL,
    has_wali BOOLEAN DEFAULT false,
    wali_name TEXT,
    wali_relation TEXT,
    wali_phone TEXT,
    wali_contact_number TEXT,
    wali_email TEXT,
    wali_verified BOOLEAN DEFAULT false,
    avatar_url TEXT,
    photo_privacy BOOLEAN DEFAULT true,
    photo_blur_hash TEXT DEFAULT 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
    bio TEXT,
    height_cm NUMERIC,
    marital_status TEXT,
    has_children BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Defensive Column Additions (Guarantees no missing columns on existing tables)
DO $$ 
BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profession TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sect TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_sect TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS prayer_frequency TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS covenant_signed BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dowry_pledge_signed BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anti_dowry_pledged BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS islamic_oath_signed BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'unverified';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_verified BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_url TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_tier TEXT DEFAULT 'free';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_known_ip TEXT DEFAULT NULL;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_wali BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_name TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_relation TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_phone TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_contact_number TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_email TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_verified BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_privacy BOOLEAN DEFAULT true;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_blur_hash TEXT DEFAULT 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marital_status TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_children BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
END $$;

-- ------------------------------------------------------------------------------
-- 3. MATCH CONNECTIONS & REQUESTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_connection_pair UNIQUE(sender_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS public.match_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. PHOTO CONSENT REQUESTS (TWO-WAY ISLAMIC PRIVACY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.photo_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. REAL-TIME MESSAGING (E2EE / HALAL CHAT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. WEBRTC CALLS & SIGNALS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'voice' CHECK (type IN ('voice', 'video')),
    status TEXT NOT NULL DEFAULT 'calling' CHECK (status IN ('calling', 'ringing', 'connected', 'ended', 'missed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.webrtc_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. SECURITY AUDIT LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    last_known_ip TEXT,
    action_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. SUBSCRIPTIONS & TRANSACTIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_tier TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    payment_provider TEXT DEFAULT 'razorpay',
    subscription_id TEXT,
    payment_id TEXT,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_discovery ON public.profiles(gender, is_active, is_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON public.profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_connections_pair ON public.connections(sender_id, receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_match_requests_lookup ON public.match_requests(sender_id, target_id, status);
CREATE INDEX IF NOT EXISTS idx_photo_requests_lookup ON public.photo_requests(requester_id, target_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_participants ON public.calls(caller_id, receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON public.security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_recorded_at ON public.security_audit_logs(recorded_at DESC);

-- ------------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webrtc_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select_active" ON public.profiles;
CREATE POLICY "profiles_select_active" ON public.profiles FOR SELECT TO authenticated, anon USING (is_active = true OR auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Connections Policies
DROP POLICY IF EXISTS "connections_select" ON public.connections;
CREATE POLICY "connections_select" ON public.connections FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "connections_insert" ON public.connections;
CREATE POLICY "connections_insert" ON public.connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "connections_update" ON public.connections;
CREATE POLICY "connections_update" ON public.connections FOR UPDATE TO authenticated USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- Match Requests Policies
DROP POLICY IF EXISTS "match_requests_select" ON public.match_requests;
CREATE POLICY "match_requests_select" ON public.match_requests FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "match_requests_insert" ON public.match_requests;
CREATE POLICY "match_requests_insert" ON public.match_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "match_requests_update" ON public.match_requests;
CREATE POLICY "match_requests_update" ON public.match_requests FOR UPDATE TO authenticated USING (auth.uid() = target_id OR auth.uid() = sender_id);

-- Photo Requests Policies
DROP POLICY IF EXISTS "photo_requests_select" ON public.photo_requests;
CREATE POLICY "photo_requests_select" ON public.photo_requests FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "photo_requests_insert" ON public.photo_requests;
CREATE POLICY "photo_requests_insert" ON public.photo_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "photo_requests_update" ON public.photo_requests;
CREATE POLICY "photo_requests_update" ON public.photo_requests FOR UPDATE TO authenticated USING (auth.uid() = target_id OR auth.uid() = requester_id);

-- Messages Policies
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_update" ON public.messages;
CREATE POLICY "messages_update" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);

-- Calls & Signals Policies
DROP POLICY IF EXISTS "calls_select" ON public.calls;
CREATE POLICY "calls_select" ON public.calls FOR SELECT TO authenticated USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "calls_insert" ON public.calls;
CREATE POLICY "calls_insert" ON public.calls FOR INSERT TO authenticated WITH CHECK (auth.uid() = caller_id);

DROP POLICY IF EXISTS "calls_update" ON public.calls;
CREATE POLICY "calls_update" ON public.calls FOR UPDATE TO authenticated USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "signals_all" ON public.webrtc_signals;
CREATE POLICY "signals_all" ON public.webrtc_signals FOR ALL TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Security Audit Logs Policies
DROP POLICY IF EXISTS "security_audit_logs_service_role" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_service_role" ON public.security_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "security_audit_logs_insert" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_insert" ON public.security_audit_logs FOR INSERT TO authenticated, anon WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 11. AUTOMATED TRIGGERS & FUNCTIONS
-- ------------------------------------------------------------------------------

-- Trigger 1: Auto-create profile on Supabase auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        gender,
        is_active,
        subscription_tier,
        membership_tier,
        kyc_status,
        covenant_signed,
        dowry_pledge_signed,
        anti_dowry_pledged,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New Member'),
        COALESCE(NEW.raw_user_meta_data->>'gender', 'female'),
        true,
        'free',
        'free',
        'unverified',
        true,
        true,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger 2: Archive IP and user state before account deletion
CREATE OR REPLACE FUNCTION public.archive_user_ip_on_delete()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
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
        RAISE WARNING 'archive_user_ip_on_delete failed: %', SQLERRM;
        RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_archive_user_ip ON public.profiles;
CREATE TRIGGER tr_archive_user_ip
    BEFORE DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.archive_user_ip_on_delete();

-- ------------------------------------------------------------------------------
-- 12. STORAGE BUCKETS CONFIGURATION
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('avatars', 'avatars', true),
    ('kyc-documents', 'kyc-documents', false),
    ('selfies', 'selfies', false),
    ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public;

-- Storage policies for avatars
DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
CREATE POLICY "Public Avatar Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated Avatar Upload" ON storage.objects;
CREATE POLICY "Authenticated Avatar Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for selfies & KYC
DROP POLICY IF EXISTS "User KYC Upload" ON storage.objects;
CREATE POLICY "User KYC Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'kyc-documents' OR bucket_id = 'selfies') AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "User KYC Read" ON storage.objects;
CREATE POLICY "User KYC Read" ON storage.objects FOR SELECT TO authenticated USING ((bucket_id = 'kyc-documents' OR bucket_id = 'selfies') AND auth.uid()::text = (storage.foldername(name))[1]);

-- ------------------------------------------------------------------------------
-- 13. ENABLE SUPABASE REALTIME REPLICATION
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.webrtc_signals;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
