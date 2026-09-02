-- ==============================================================================
-- DAHEEJFREE MASTER DATABASE REPAIR & FULL SYNCHRONIZATION SCRIPT
-- Paste and run this script in the Supabase SQL Editor.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PROFILES TABLE (MASTER DEFINITION & COLUMN ALIGNMENT)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    full_name TEXT NOT NULL DEFAULT 'Nikah Candidate',
    nickname TEXT,
    phone_number TEXT,
    gender TEXT DEFAULT 'male' CHECK (gender IN ('male', 'female')),
    avatar_url TEXT,
    wali_name TEXT,
    wali_relation TEXT DEFAULT 'Father',
    wali_phone TEXT,
    wali_email TEXT,
    wali_verified BOOLEAN DEFAULT false,
    kyc_status TEXT NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'banned')),
    kyc_document_type TEXT,
    kyc_document_url TEXT,
    kyc_session_id TEXT,
    didit_session_url TEXT,
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'gold', 'platinum', 'diamond')),
    subscription_id TEXT,
    subscription_status TEXT DEFAULT 'active',
    anti_dowry_pledged BOOLEAN NOT NULL DEFAULT true,
    anti_dowry_pledge BOOLEAN DEFAULT true,
    islamic_oath_signed BOOLEAN DEFAULT false,
    islamic_oath_date TIMESTAMPTZ,
    covenant_signed BOOLEAN DEFAULT false,
    covenant_signed_at TIMESTAMPTZ,
    is_onboarded BOOLEAN DEFAULT false,
    last_known_ip TEXT,
    bio TEXT,
    age INTEGER DEFAULT 24,
    profession TEXT DEFAULT 'Working Professional',
    location TEXT DEFAULT 'India',
    city TEXT DEFAULT 'India',
    education TEXT DEFAULT 'Bachelor Degree',
    sect TEXT DEFAULT 'Sunni' CHECK (sect IN ('Sunni', 'Shia', 'Just Muslim', 'Other')),
    preferred_sect TEXT DEFAULT 'Any' CHECK (preferred_sect IN ('Sunni', 'Shia', 'Just Muslim', 'Any')),
    religious_sect TEXT DEFAULT 'Sunni',
    religious_practice TEXT,
    prayer_frequency TEXT,
    quran_recitation TEXT,
    marital_status TEXT DEFAULT 'Never Married',
    has_children BOOLEAN DEFAULT false,
    height_cm NUMERIC,
    photo_privacy BOOLEAN DEFAULT false,
    is_photo_private BOOLEAN DEFAULT false,
    photo_privacy_mode TEXT DEFAULT 'liked_only',
    selfie_verified BOOLEAN DEFAULT false,
    selfie_url TEXT,
    selfie_verification_url TEXT,
    icebreakers TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on existing profiles table if previously created
DO $$ 
BEGIN 
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sect TEXT DEFAULT 'Sunni';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_sect TEXT DEFAULT 'Any';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS religious_sect TEXT DEFAULT 'Sunni';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_known_ip TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER DEFAULT 24;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'India';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'India';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profession TEXT DEFAULT 'Working Professional';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education TEXT DEFAULT 'Bachelor Degree';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_name TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_phone TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_relation TEXT DEFAULT 'Father';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_email TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wali_verified BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anti_dowry_pledged BOOLEAN DEFAULT true;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anti_dowry_pledge BOOLEAN DEFAULT true;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_privacy BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_photo_private BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo_privacy_mode TEXT DEFAULT 'liked_only';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_verified BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_url TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selfie_verification_url TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_session_id TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS didit_session_url TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_id TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS icebreakers TEXT[] DEFAULT ARRAY[]::TEXT[];
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
END $$;

-- 3. MUTUAL CONNECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_connection_pair UNIQUE (sender_id, receiver_id)
);

-- 4. 2-WAY PHOTO CONSENT REQUESTS (TABLE & ALIAS TABLE)
CREATE TABLE IF NOT EXISTS public.consent_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'approved', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_consent_pair UNIQUE (requester_id, target_id)
);

CREATE TABLE IF NOT EXISTS public.photo_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'approved', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_photo_req_pair UNIQUE (requester_id, target_id)
);

-- 5. CHAT MESSAGES & CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_one UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_two UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_convo_pair UNIQUE (participant_one, participant_two)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_nsfw BOOLEAN NOT NULL DEFAULT false,
    is_dowry_demand BOOLEAN NOT NULL DEFAULT false,
    moderation_flagged BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. WEBRTC P2P CALLS & SIGNALING TABLE
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    callee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL DEFAULT 'voice' CHECK (call_type IN ('voice', 'video', 'audio')),
    status TEXT NOT NULL DEFAULT 'connecting' CHECK (status IN ('connecting', 'ringing', 'active', 'completed', 'declined', 'missed')),
    sdp_offer JSONB,
    sdp_answer JSONB,
    ice_candidates JSONB DEFAULT '[]'::JSONB,
    duration_seconds INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tier TEXT NOT NULL CHECK (tier IN ('free', 'gold', 'platinum', 'diamond')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,
    razorpay_order_id TEXT,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated, anon USING (true);

-- Connections Policies
DROP POLICY IF EXISTS "connections_all" ON public.connections;
CREATE POLICY "connections_all" ON public.connections FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Photo Consent Policies
DROP POLICY IF EXISTS "consent_all" ON public.consent_requests;
CREATE POLICY "consent_all" ON public.consent_requests FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "photo_requests_all" ON public.photo_requests;
CREATE POLICY "photo_requests_all" ON public.photo_requests FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Messages & Conversations Policies
DROP POLICY IF EXISTS "convo_all" ON public.conversations;
CREATE POLICY "convo_all" ON public.conversations FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "messages_all" ON public.messages;
CREATE POLICY "messages_all" ON public.messages FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Calls Policies
DROP POLICY IF EXISTS "calls_all" ON public.calls;
CREATE POLICY "calls_all" ON public.calls FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Subscriptions Policies
DROP POLICY IF EXISTS "subscriptions_all" ON public.subscriptions;
CREATE POLICY "subscriptions_all" ON public.subscriptions FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 9. SUPABASE STORAGE BUCKETS & POLICIES
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('avatars', 'avatars', true),
    ('kyc-documents', 'kyc-documents', false),
    ('selfies', 'selfies', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Upload avatar access" ON storage.objects;
DROP POLICY IF EXISTS "Update avatar access" ON storage.objects;

CREATE POLICY "Public avatar access" ON storage.objects FOR SELECT TO public USING (bucket_id IN ('avatars', 'selfies'));
CREATE POLICY "Upload avatar access" ON storage.objects FOR INSERT TO authenticated, anon WITH CHECK (bucket_id IN ('avatars', 'kyc-documents', 'selfies'));
CREATE POLICY "Update avatar access" ON storage.objects FOR UPDATE TO authenticated, anon USING (bucket_id IN ('avatars', 'kyc-documents', 'selfies'));

-- 10. REALTIME REPLICATION SETUP
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.connections REPLICA IDENTITY FULL;
ALTER TABLE public.consent_requests REPLICA IDENTITY FULL;
ALTER TABLE public.photo_requests REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.calls REPLICA IDENTITY FULL;

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.consent_requests;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_requests;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;
