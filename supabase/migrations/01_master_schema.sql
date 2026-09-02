-- ==============================================================================
-- DAHEEJFREE MATRIMONY: V4 ENTERPRISE MASTER SCHEMA & RLS SECURITY POLICIES
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Enumeration Types
DO $$ BEGIN
    CREATE TYPE user_gender AS ENUM ('female', 'male');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kyc_status_enum AS ENUM ('unverified', 'pending', 'verified', 'banned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_tier_enum AS ENUM ('free', 'gold', 'platinum', 'diamond');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE consent_status_enum AS ENUM ('pending', 'approved', 'rejected', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE call_status_enum AS ENUM ('connecting', 'active', 'completed', 'declined', 'missed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE call_type_enum AS ENUM ('audio', 'video');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE billing_cycle_enum AS ENUM ('monthly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 3. PROFILES TABLE (Core User Demographic, Shariah, and KYC Data)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    gender user_gender NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 18 AND age <= 80),
    avatar_url TEXT,
    bio TEXT,
    location TEXT NOT NULL,
    profession TEXT,
    education TEXT,
    religious_sect TEXT DEFAULT 'Sunni',
    marital_status TEXT DEFAULT 'Never Married',
    has_children BOOLEAN DEFAULT FALSE,
    height_cm INTEGER,
    anti_dowry_pledged BOOLEAN DEFAULT TRUE NOT NULL,
    kyc_status kyc_status_enum DEFAULT 'pending' NOT NULL,
    kyc_document_type TEXT,
    kyc_document_url TEXT,
    wali_name TEXT,
    wali_relation TEXT,
    wali_phone TEXT,
    wali_email TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- 4. SUBSCRIPTIONS TABLE (Mapped strictly via profile_id and tier)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    tier subscription_tier_enum DEFAULT 'free' NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL,
    billing_cycle billing_cycle_enum DEFAULT 'monthly' NOT NULL,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_subscription_id TEXT,
    current_period_start TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    current_period_end TIMESTAMPTZ DEFAULT (TIMEZONE('utc'::text, NOW()) + INTERVAL '30 days') NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- 5. PHOTO CONSENT REQUESTS (2-Way Privacy Barrier)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.consent_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status consent_status_enum DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_consent_pair UNIQUE (requester_id, target_id)
);

-- ==============================================================================
-- 6. WEBRTC CALL RECORDS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    callee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type call_type_enum DEFAULT 'video' NOT NULL,
    status call_status_enum DEFAULT 'connecting' NOT NULL,
    started_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- 7. REALTIME CHAT MESSAGES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_nsfw BOOLEAN DEFAULT FALSE NOT NULL,
    is_dowry_demand BOOLEAN DEFAULT FALSE NOT NULL,
    moderation_flagged BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================================================
-- 8. INDEXES FOR HIGH-THROUGHPUT REALTIME DISCOVERY & SIGNALING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON public.profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles(gender);
CREATE INDEX IF NOT EXISTS idx_subscriptions_profile_id ON public.subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_consent_requester_target ON public.consent_requests(requester_id, target_id);
CREATE INDEX IF NOT EXISTS idx_calls_caller_recipient ON public.calls(caller_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient ON public.messages(sender_id, recipient_id);

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) ACTIVATION
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- PROFILES RLS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Verified users can view unbanned profiles" ON public.profiles;
CREATE POLICY "Verified users can view unbanned profiles"
    ON public.profiles FOR SELECT
    USING (
        kyc_status != 'banned'
        AND (
            auth.uid() = id
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND kyc_status = 'verified'
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- SUBSCRIPTIONS RLS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
    ON public.subscriptions FOR SELECT
    USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Service role / Users can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role / Users can manage subscriptions"
    ON public.subscriptions FOR ALL
    USING (profile_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

-- ------------------------------------------------------------------------------
-- PHOTO CONSENT RLS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view relevant consent requests" ON public.consent_requests;
CREATE POLICY "Users can view relevant consent requests"
    ON public.consent_requests FOR SELECT
    USING (requester_id = auth.uid() OR target_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert consent requests" ON public.consent_requests;
CREATE POLICY "Users can insert consent requests"
    ON public.consent_requests FOR INSERT
    WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "Target users can update consent status" ON public.consent_requests;
CREATE POLICY "Target users can update consent status"
    ON public.consent_requests FOR UPDATE
    USING (target_id = auth.uid() OR requester_id = auth.uid());

-- ------------------------------------------------------------------------------
-- WEBRTC CALLS RLS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view calls they are participating in" ON public.calls;
CREATE POLICY "Users can view calls they are participating in"
    ON public.calls FOR SELECT
    USING (caller_id = auth.uid() OR recipient_id = auth.uid() OR callee_id = auth.uid());

DROP POLICY IF EXISTS "Users can initiate calls" ON public.calls;
CREATE POLICY "Users can initiate calls"
    ON public.calls FOR INSERT
    WITH CHECK (caller_id = auth.uid());

DROP POLICY IF EXISTS "Call participants can update call state" ON public.calls;
CREATE POLICY "Call participants can update call state"
    ON public.calls FOR UPDATE
    USING (caller_id = auth.uid() OR recipient_id = auth.uid() OR callee_id = auth.uid());

-- ------------------------------------------------------------------------------
-- REALTIME MESSAGES RLS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view messages sent or received" ON public.messages;
CREATE POLICY "Users can view messages sent or received"
    ON public.messages FOR SELECT
    USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert messages" ON public.messages;
CREATE POLICY "Users can insert messages"
    ON public.messages FOR INSERT
    WITH CHECK (sender_id = auth.uid());

-- ==============================================================================
-- 10. SECURITY FUNCTIONS & SHARIAH PRIVACY RPC
-- ==============================================================================

-- A. Function: Check Mutual Photo Consent
CREATE OR REPLACE FUNCTION public.check_mutual_photo_consent(viewer_id UUID, target_profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF viewer_id = target_profile_id THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.consent_requests
        WHERE status = 'approved'
        AND (
            (requester_id = viewer_id AND target_id = target_profile_id)
            OR (requester_id = target_profile_id AND target_id = viewer_id)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Function: Check Diamond Tier Wali Access Privilege
CREATE OR REPLACE FUNCTION public.check_wali_access(viewer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE profile_id = viewer_id
        AND tier = 'diamond'
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Secure Profile Discovery Feed (Applies Photo Blur & Gated Wali Access)
CREATE OR REPLACE FUNCTION public.get_secure_matrimonial_feed(viewer_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    gender user_gender,
    age INTEGER,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    profession TEXT,
    education TEXT,
    religious_sect TEXT,
    marital_status TEXT,
    has_children BOOLEAN,
    height_cm INTEGER,
    anti_dowry_pledged BOOLEAN,
    kyc_status kyc_status_enum,
    is_photo_unlocked BOOLEAN,
    is_wali_unlocked BOOLEAN,
    wali_name TEXT,
    wali_relation TEXT,
    wali_phone TEXT,
    wali_email TEXT
) AS $$
DECLARE
    has_diamond_access BOOLEAN;
BEGIN
    SELECT public.check_wali_access(viewer_id) INTO has_diamond_access;

    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        p.gender,
        p.age,
        CASE
            WHEN p.id = viewer_id OR public.check_mutual_photo_consent(viewer_id, p.id) THEN p.avatar_url
            ELSE NULL
        END AS avatar_url,
        p.bio,
        p.location,
        p.profession,
        p.education,
        p.religious_sect,
        p.marital_status,
        p.has_children,
        p.height_cm,
        p.anti_dowry_pledged,
        p.kyc_status,
        (p.id = viewer_id OR public.check_mutual_photo_consent(viewer_id, p.id)) AS is_photo_unlocked,
        (p.id = viewer_id OR has_diamond_access) AS is_wali_unlocked,
        CASE WHEN (p.id = viewer_id OR has_diamond_access) THEN p.wali_name ELSE NULL END AS wali_name,
        CASE WHEN (p.id = viewer_id OR has_diamond_access) THEN p.wali_relation ELSE NULL END AS wali_relation,
        CASE WHEN (p.id = viewer_id OR has_diamond_access) THEN p.wali_phone ELSE NULL END AS wali_phone,
        CASE WHEN (p.id = viewer_id OR has_diamond_access) THEN p.wali_email ELSE NULL END AS wali_email
    FROM public.profiles p
    WHERE p.kyc_status != 'banned'
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
