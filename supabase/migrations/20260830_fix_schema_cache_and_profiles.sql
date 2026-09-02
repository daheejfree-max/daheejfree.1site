-- ==============================================================================
-- DAHEEJFREE MATRIMONIAL PLATFORM - 100% IDEMPOTENT PRODUCTION MIGRATION
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query > Run)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE: public.profiles (Create table + Idempotent Column Additions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent column additions for backward and forward compatibility
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT 'Matrimonial Member';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS candidate_role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sect TEXT DEFAULT 'Sunni';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS religious_sect TEXT DEFAULT 'Sunni';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_sect TEXT DEFAULT 'Any';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS religious_practice TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS prayer_frequency TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quran_recitation TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_children BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm NUMERIC;

-- Guardian (Wali) Fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_relation TEXT DEFAULT 'Father';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_contact_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_wali BOOLEAN DEFAULT true;

-- Shariah Anti-Dowry Covenant Pledges (Aliases for full schema flexibility)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anti_dowry_pledge BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anti_dowry_pledged BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dowry_pledge_signed BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS islamic_oath_signed BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS islamic_oath_date TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS covenant_signed BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS covenant_signed_at TIMESTAMPTZ DEFAULT now();

-- KYC & Verification Statuses
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'banned'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_document_type TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_document_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_session_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS didit_session_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_verification_url TEXT;

-- Realtime Presence & Activity
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT true;

-- Subscription & Privacy Settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS membership_tier TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_privacy BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_photo_private BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_privacy_mode TEXT DEFAULT 'liked_only';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_blur_hash TEXT DEFAULT 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

-- Audit & Legal
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_consent_accepted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_known_ip TEXT;

-- ==============================================================================
-- 3. TABLE: public.messages
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read BOOLEAN NOT NULL DEFAULT false,
    is_dowry_demand BOOLEAN NOT NULL DEFAULT false,
    is_nsfw BOOLEAN NOT NULL DEFAULT false,
    moderation_flagged BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. TABLE: public.photo_permissions
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.photo_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requestor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure Unique constraint on requestor_id + target_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_photo_permissions_pair'
    ) THEN
        ALTER TABLE public.photo_permissions ADD CONSTRAINT uq_photo_permissions_pair UNIQUE (requestor_id, target_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 5. TABLE: public.call_signals & public.calls
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.call_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL,
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    signal_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL DEFAULT 'voice',
    status TEXT NOT NULL DEFAULT 'calling',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    sdp_offer JSONB,
    sdp_answer JSONB,
    ice_candidates JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 6. TABLE: public.connections & public.match_requests
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_connections_pair') THEN
        ALTER TABLE public.connections ADD CONSTRAINT uq_connections_pair UNIQUE (sender_id, receiver_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 7. PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active, gender);
CREATE INDEX IF NOT EXISTS idx_messages_users ON public.messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_permissions_pair ON public.photo_permissions(requestor_id, target_id);
CREATE INDEX IF NOT EXISTS idx_call_signals_room ON public.call_signals(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connections_users ON public.connections(sender_id, receiver_id);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) & POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated, anon USING (is_active = true OR auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Messages Policies
DROP POLICY IF EXISTS "messages_all" ON public.messages;
CREATE POLICY "messages_all" ON public.messages FOR ALL TO authenticated USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id OR auth.uid() = recipient_id
) WITH CHECK (
    auth.uid() = sender_id OR auth.uid() = receiver_id OR auth.uid() = recipient_id
);

-- Photo Permissions Policies
DROP POLICY IF EXISTS "photo_permissions_all" ON public.photo_permissions;
CREATE POLICY "photo_permissions_all" ON public.photo_permissions FOR ALL TO authenticated USING (
    auth.uid() = requestor_id OR auth.uid() = requester_id OR 
    auth.uid() = target_id OR auth.uid() = target_user_id
) WITH CHECK (
    auth.uid() = requestor_id OR auth.uid() = requester_id OR 
    auth.uid() = target_id OR auth.uid() = target_user_id
);

-- Call Signals Policies
DROP POLICY IF EXISTS "call_signals_all" ON public.call_signals;
CREATE POLICY "call_signals_all" ON public.call_signals FOR ALL TO authenticated USING (
    auth.uid() = caller_id OR auth.uid() = receiver_id
) WITH CHECK (
    auth.uid() = caller_id OR auth.uid() = receiver_id
);

DROP POLICY IF EXISTS "calls_all" ON public.calls;
CREATE POLICY "calls_all" ON public.calls FOR ALL TO authenticated USING (
    auth.uid() = caller_id OR auth.uid() = receiver_id OR auth.uid() = recipient_id
) WITH CHECK (
    auth.uid() = caller_id OR auth.uid() = receiver_id OR auth.uid() = recipient_id
);

-- Connections Policies
DROP POLICY IF EXISTS "connections_all" ON public.connections;
CREATE POLICY "connections_all" ON public.connections FOR ALL TO authenticated USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
) WITH CHECK (
    auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- ==============================================================================
-- 9. AUTH SIGNUP TRIGGER (AUTOMATIC PROFILE INITIALIZATION)
-- ==============================================================================
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
        candidate_role,
        is_active,
        is_onboarded,
        is_online,
        last_seen,
        subscription_tier,
        membership_tier,
        kyc_status,
        kyc_verified,
        anti_dowry_pledge,
        anti_dowry_pledged,
        dowry_pledge_signed,
        covenant_signed,
        legal_consent_accepted_at,
        terms_accepted,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New Member'),
        COALESCE(NEW.raw_user_meta_data->>'gender', 'female'),
        COALESCE(NEW.raw_user_meta_data->>'candidate_role', NEW.raw_user_meta_data->>'gender', 'female'),
        true,
        true,
        true,
        now(),
        'free',
        'free',
        'unverified',
        false,
        true,
        true,
        true,
        true,
        now(),
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        is_online = true,
        last_seen = now(),
        updated_at = now();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 10. SUPABASE STORAGE BUCKETS (Avatars, KYC, Selfies)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('avatars', 'avatars', true),
    ('kyc-documents', 'kyc-documents', false),
    ('selfies', 'selfies', false),
    ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
CREATE POLICY "Public Avatar Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated Avatar Upload" ON storage.objects;
CREATE POLICY "Authenticated Avatar Upload" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "User KYC Upload" ON storage.objects;
CREATE POLICY "User KYC Upload" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'kyc-documents' OR bucket_id = 'selfies') WITH CHECK (bucket_id = 'kyc-documents' OR bucket_id = 'selfies');

-- ==============================================================================
-- 11. SUPABASE REALTIME PUBLICATION
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_permissions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
