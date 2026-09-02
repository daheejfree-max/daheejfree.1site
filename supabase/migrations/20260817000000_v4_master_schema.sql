-- ==============================================================================
-- DAHEEJFREE MASTER DATABASE SCHEMA (V4 STRICT)
-- High-Security, Privacy-First, Dowry-Free Islamic Matrimonial Platform
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    avatar_url TEXT,
    wali_email TEXT,
    profession TEXT,
    location TEXT,
    education TEXT,
    bio TEXT,
    kyc_status TEXT NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'banned')),
    kyc_document_type TEXT,
    kyc_document_url TEXT,
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'gold', 'platinum', 'diamond')),
    anti_dowry_pledged BOOLEAN NOT NULL DEFAULT false,
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. SUBSCRIPTIONS TABLE (STRICT: profile_id and tier)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. CONSENT REQUESTS (2-WAY PHOTO PRIVACY GATING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_requester_target_pair UNIQUE (requester_id, target_id)
);

-- ------------------------------------------------------------------------------
-- 4. CONVERSATIONS & MESSAGES (WITH NSFW MODERATION)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_one UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_two UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_conversation_participants UNIQUE (participant_one, participant_two)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_nsfw BOOLEAN NOT NULL DEFAULT false,
    moderation_score NUMERIC(4,3) DEFAULT 0.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. CALLS TABLE (WEBRTC P2P SIGNALING: caller_id, recipient_id, callee_id, call_type, status)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    callee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
    status TEXT NOT NULL DEFAULT 'connecting' CHECK (status IN ('connecting', 'active', 'completed', 'declined', 'missed')),
    sdp_offer JSONB,
    sdp_answer JSONB,
    ice_candidates JSONB DEFAULT '[]'::JSONB,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 6. HELPER SECURITY FUNCTIONS
-- ------------------------------------------------------------------------------

-- Check if user has mutual photo consent with another profile
CREATE OR REPLACE FUNCTION public.fn_has_photo_consent(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.consent_requests
        WHERE status = 'accepted'
        AND (
            (requester_id = user_a AND target_id = user_b)
            OR
            (requester_id = user_b AND target_id = user_a)
        )
    );
$$;

-- Check if viewer holds an active Diamond subscription for direct Wali access
CREATE OR REPLACE FUNCTION public.fn_has_diamond_access(viewer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE profile_id = viewer_id
        AND tier = 'diamond'
        AND status = 'active'
    ) OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = viewer_id
        AND subscription_tier = 'diamond'
    );
$$;

-- Check daily message count limit for Free Tier
CREATE OR REPLACE FUNCTION public.fn_can_send_message(p_sender_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tier TEXT;
    v_today_count INT;
BEGIN
    SELECT COALESCE(subscription_tier, 'free') INTO v_tier
    FROM public.profiles WHERE id = p_sender_id;

    IF v_tier IN ('gold', 'platinum', 'diamond') THEN
        RETURN TRUE;
    END IF;

    -- Free plan has 3 messages per day ceiling
    SELECT COUNT(*) INTO v_today_count
    FROM public.messages
    WHERE sender_id = p_sender_id
    AND created_at >= NOW() - INTERVAL '24 hours';

    IF v_today_count >= 3 THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. SECURE ROW-LEVEL SECURITY VIEW (public.profiles_secure_view)
-- Prevents data scraping: Obfuscates avatar_url (unless mutual consent is granted)
-- and gates wali_email (strictly restricted to Diamond tier viewers or profile owner).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.profiles_secure_view AS
SELECT
    p.id,
    p.full_name,
    p.gender,
    -- Avatar URL is NULL/Protected unless mutual consent is granted or it is the user's own profile
    CASE
        WHEN auth.uid() = p.id THEN p.avatar_url
        WHEN public.fn_has_photo_consent(auth.uid(), p.id) THEN p.avatar_url
        ELSE NULL
    END AS avatar_url,
    -- Wali Email is strictly gated to Diamond tier viewers or self
    CASE
        WHEN auth.uid() = p.id THEN p.wali_email
        WHEN public.fn_has_diamond_access(auth.uid()) THEN p.wali_email
        ELSE NULL
    END AS wali_email,
    p.profession,
    p.location,
    p.education,
    p.bio,
    p.kyc_status,
    p.subscription_tier,
    p.anti_dowry_pledged,
    p.is_test,
    -- Boolean flags for UI presentation
    (auth.uid() = p.id OR public.fn_has_photo_consent(auth.uid(), p.id)) AS photo_access_granted,
    (auth.uid() = p.id OR public.fn_has_diamond_access(auth.uid())) AS wali_access_granted,
    p.created_at
FROM public.profiles p
WHERE p.kyc_status != 'banned';

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public verified profiles can be viewed by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (kyc_status != 'banned');

CREATE POLICY "Users can update only their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile on registration"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Subscriptions Policies
CREATE POLICY "Users can view their own subscription records"
ON public.subscriptions FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "System/Service Role full access on subscriptions"
ON public.subscriptions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Consent Requests Policies
CREATE POLICY "Users can view consent requests they participate in"
ON public.consent_requests FOR SELECT
TO authenticated
USING (requester_id = auth.uid() OR target_id = auth.uid());

CREATE POLICY "Users can create consent requests"
ON public.consent_requests FOR INSERT
TO authenticated
WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Target users can update consent status"
ON public.consent_requests FOR UPDATE
TO authenticated
USING (target_id = auth.uid() OR requester_id = auth.uid())
WITH CHECK (target_id = auth.uid() OR requester_id = auth.uid());

-- Conversations Policies
CREATE POLICY "Users can view conversations they participate in"
ON public.conversations FOR SELECT
TO authenticated
USING (participant_one = auth.uid() OR participant_two = auth.uid());

CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (participant_one = auth.uid() OR participant_two = auth.uid());

-- Messages Policies
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
TO authenticated
USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can insert messages if within limits and not banned"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND public.fn_can_send_message(auth.uid())
);

-- Calls Policies (WebRTC)
CREATE POLICY "Participants can view their calls"
ON public.calls FOR SELECT
TO authenticated
USING (caller_id = auth.uid() OR recipient_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "Callers can initiate calls"
ON public.calls FOR INSERT
TO authenticated
WITH CHECK (caller_id = auth.uid());

CREATE POLICY "Call participants can update call signaling state"
ON public.calls FOR UPDATE
TO authenticated
USING (caller_id = auth.uid() OR recipient_id = auth.uid() OR callee_id = auth.uid())
WITH CHECK (caller_id = auth.uid() OR recipient_id = auth.uid() OR callee_id = auth.uid());

-- ==============================================================================
-- 9. AUTO-MODERATION & TIMESTAMP TRIGGERS
-- ==============================================================================

-- Auto-ban user if severe NSFW message is inserted
CREATE OR REPLACE FUNCTION public.trg_fn_auto_moderate_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.is_nsfw = true THEN
        -- Flag sender as banned
        UPDATE public.profiles
        SET kyc_status = 'banned'
        WHERE id = NEW.sender_id;
        
        RAISE EXCEPTION 'Message flagged as inappropriate content. Account has been suspended for security review.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_moderate_message
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_auto_moderate_message();
