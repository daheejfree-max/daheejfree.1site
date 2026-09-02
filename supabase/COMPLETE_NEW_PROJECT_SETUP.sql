-- ==============================================================================
-- DAHEEJFREE MATRIMONIAL PLATFORM - 100% COMPLETE NEW PROJECT SCHEMA
-- Run this ENTIRE script in your new Supabase Project SQL Editor
-- (Supabase Dashboard > SQL Editor > New query > Paste & Click RUN)
-- ==============================================================================

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE: public.profiles
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'Matrimonial Member',
    nickname TEXT,
    phone_number TEXT,
    gender TEXT CHECK (gender IN ('male', 'female')),
    age INTEGER CHECK (age >= 18 OR age IS NULL),
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    city TEXT,
    state TEXT,
    profession TEXT,
    education TEXT,
    sect TEXT DEFAULT 'Sunni',
    preferred_sect TEXT DEFAULT 'Any',
    religious_practice TEXT,
    prayer_frequency TEXT,
    quran_recitation TEXT,
    marital_status TEXT,
    has_children BOOLEAN DEFAULT false,
    height_cm NUMERIC,
    
    -- Wali (Guardian)
    wali_name TEXT,
    wali_relation TEXT DEFAULT 'Father',
    wali_phone TEXT,
    wali_contact_number TEXT,
    wali_email TEXT,
    wali_verified BOOLEAN DEFAULT false,
    has_wali BOOLEAN DEFAULT true,

    -- Shariah Anti-Dowry Covenant
    anti_dowry_pledged BOOLEAN DEFAULT true,
    dowry_pledge_signed BOOLEAN DEFAULT true,
    islamic_oath_signed BOOLEAN DEFAULT false,
    islamic_oath_date TIMESTAMPTZ,
    covenant_signed BOOLEAN DEFAULT true,
    covenant_signed_at TIMESTAMPTZ DEFAULT now(),

    -- KYC & Identity Verification
    kyc_status TEXT NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'banned')),
    is_verified BOOLEAN DEFAULT false,
    kyc_document_type TEXT,
    kyc_document_url TEXT,
    kyc_session_id TEXT,
    didit_session_url TEXT,
    selfie_verified BOOLEAN DEFAULT false,
    selfie_url TEXT,
    selfie_verification_url TEXT,

    -- Subscription (Tiers: free, gold, diamond, platinum)
    subscription_tier TEXT NOT NULL DEFAULT 'free',
    membership_tier TEXT DEFAULT 'free',
    subscription_id TEXT,
    subscription_status TEXT DEFAULT 'active',

    -- Privacy Controls
    photo_privacy BOOLEAN DEFAULT true,
    is_photo_private BOOLEAN DEFAULT true,
    photo_privacy_mode TEXT DEFAULT 'liked_only',
    photo_blur_hash TEXT DEFAULT 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',

    -- Audit & Timestamps
    legal_consent_accepted_at TIMESTAMPTZ,
    terms_accepted BOOLEAN DEFAULT true,
    last_known_ip TEXT,
    is_active BOOLEAN DEFAULT true,
    is_onboarded BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. TABLE: public.photo_permissions & public.photo_requests (Photo Consents)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.photo_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requestor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'approved', 'rejected', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.photo_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'accepted', 'rejected', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 4. TABLE: public.call_signals & public.calls & public.webrtc_signals (WebRTC Calling)
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    callee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.webrtc_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 5. TABLE: public.connections & public.match_requests (Matching & Match Requests)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_connections_pair UNIQUE (sender_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS public.match_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 6. TABLE: public.messages (Realtime Halal Matrimonial Chat)
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
    is_nsfw BOOLEAN NOT NULL DEFAULT false,
    is_dowry_demand BOOLEAN NOT NULL DEFAULT false,
    moderation_flagged BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 7. TABLE: public.subscriptions & public.security_audit_logs
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'free',
    plan_tier TEXT DEFAULT 'free',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    status TEXT NOT NULL DEFAULT 'active',
    dodo_customer_id TEXT,
    dodo_subscription_id TEXT,
    dodo_payment_id TEXT,
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,
    razorpay_order_id TEXT,
    current_period_start TIMESTAMPTZ DEFAULT now(),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    last_known_ip TEXT,
    action_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 8. INDEXES FOR LIGHTWEIGHT HIGH-SPEED QUERIES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(is_active, gender);
CREATE INDEX IF NOT EXISTS idx_call_signals_lookup ON public.call_signals(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_permissions_users ON public.photo_permissions(requestor_id, target_id);
CREATE INDEX IF NOT EXISTS idx_connections_users ON public.connections(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_users ON public.messages(sender_id, receiver_id, created_at DESC);

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webrtc_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: View all active, insert/update own
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated, anon USING (is_active = true OR auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Photo Permissions: Participants can select, insert, update, delete
DROP POLICY IF EXISTS "photo_permissions_all" ON public.photo_permissions;
CREATE POLICY "photo_permissions_all" ON public.photo_permissions FOR ALL TO authenticated USING (
    auth.uid() = requestor_id OR auth.uid() = requester_id OR 
    auth.uid() = target_id OR auth.uid() = target_user_id
) WITH CHECK (
    auth.uid() = requestor_id OR auth.uid() = requester_id OR 
    auth.uid() = target_id OR auth.uid() = target_user_id
);

DROP POLICY IF EXISTS "photo_requests_all" ON public.photo_requests;
CREATE POLICY "photo_requests_all" ON public.photo_requests FOR ALL TO authenticated USING (
    auth.uid() = requester_id OR auth.uid() = target_id
) WITH CHECK (
    auth.uid() = requester_id OR auth.uid() = target_id
);

-- Call Signals & Calls: Participants can select, insert, update, delete
DROP POLICY IF EXISTS "call_signals_all" ON public.call_signals;
CREATE POLICY "call_signals_all" ON public.call_signals FOR ALL TO authenticated USING (
    auth.uid() = caller_id OR auth.uid() = receiver_id
) WITH CHECK (
    auth.uid() = caller_id OR auth.uid() = receiver_id
);

DROP POLICY IF EXISTS "calls_all" ON public.calls;
CREATE POLICY "calls_all" ON public.calls FOR ALL TO authenticated USING (
    auth.uid() = caller_id OR auth.uid() = receiver_id OR auth.uid() = recipient_id OR auth.uid() = callee_id
) WITH CHECK (
    auth.uid() = caller_id OR auth.uid() = receiver_id OR auth.uid() = recipient_id OR auth.uid() = callee_id
);

DROP POLICY IF EXISTS "webrtc_signals_all" ON public.webrtc_signals;
CREATE POLICY "webrtc_signals_all" ON public.webrtc_signals FOR ALL TO authenticated USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
) WITH CHECK (
    auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- Connections & Match Requests
DROP POLICY IF EXISTS "connections_all" ON public.connections;
CREATE POLICY "connections_all" ON public.connections FOR ALL TO authenticated USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
) WITH CHECK (
    auth.uid() = sender_id OR auth.uid() = receiver_id
);

DROP POLICY IF EXISTS "match_requests_all" ON public.match_requests;
CREATE POLICY "match_requests_all" ON public.match_requests FOR ALL TO authenticated USING (
    auth.uid() = sender_id OR auth.uid() = target_id
) WITH CHECK (
    auth.uid() = sender_id OR auth.uid() = target_id
);

-- Messages
DROP POLICY IF EXISTS "messages_all" ON public.messages;
CREATE POLICY "messages_all" ON public.messages FOR ALL TO authenticated USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id OR auth.uid() = recipient_id
) WITH CHECK (
    auth.uid() = sender_id OR auth.uid() = receiver_id OR auth.uid() = recipient_id
);

-- Subscriptions & Audit Logs
DROP POLICY IF EXISTS "subscriptions_all" ON public.subscriptions;
CREATE POLICY "subscriptions_all" ON public.subscriptions FOR ALL TO authenticated USING (
    auth.uid() = profile_id OR auth.uid() = user_id
) WITH CHECK (
    auth.uid() = profile_id OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "audit_logs_insert" ON public.security_audit_logs;
CREATE POLICY "audit_logs_insert" ON public.security_audit_logs FOR INSERT TO authenticated, anon WITH CHECK (true);

-- ==============================================================================
-- 10. AUTH TRIGGER: AUTO CREATE PROFILE ON SIGNUP
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
        is_active,
        is_onboarded,
        subscription_tier,
        membership_tier,
        kyc_status,
        covenant_signed,
        dowry_pledge_signed,
        anti_dowry_pledged,
        legal_consent_accepted_at,
        terms_accepted,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New Member'),
        COALESCE(NEW.raw_user_meta_data->>'gender', 'female'),
        true,
        true,
        'free',
        'free',
        'unverified',
        true,
        true,
        true,
        now(),
        true,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        terms_accepted = true,
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
-- 11. STORAGE BUCKETS SETUP (Avatars, KYC Documents, Selfies)
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
-- 12. ENABLE SUPABASE REALTIME REPLICATION (Instant Calls, Messages, Photo Consent)
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_permissions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
