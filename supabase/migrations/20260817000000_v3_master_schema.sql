-- ==============================================================================
-- DAHEEJFREE MATRIMONIAL PLATFORM - MASTER DATABASE SCHEMA (V3 STRICT)
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Drop existing triggers & functions if present
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.has_active_diamond_subscription(UUID);
DROP FUNCTION IF EXISTS public.has_accepted_photo_consent(UUID, UUID);

-- ------------------------------------------------------------------------------
-- TABLE A: public.profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    wali_email TEXT,
    kyc_status TEXT NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified')),
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'gold', 'platinum', 'diamond')),
    is_test BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- TABLE B: public.subscriptions
-- (CRITICAL: Uses profile_id and tier, NEVER user_id or plan_name)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'gold', 'platinum', 'diamond')),
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    current_period_start TIMESTAMPTZ DEFAULT now(),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- TABLE C: public.calls (WebRTC Signaling)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    callee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video', 'audio')),
    status TEXT NOT NULL DEFAULT 'connecting' CHECK (status IN ('connecting', 'active', 'completed', 'declined', 'missed', 'ringing')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- TABLE D: public.consent_requests (2-Way Photo Privacy)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_requester_target UNIQUE (requester_id, target_id)
);

-- ------------------------------------------------------------------------------
-- INDEXES FOR PERFORMANCE & FAST LOOKUPS
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_subscriptions_profile_status ON public.subscriptions(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_caller_recipient ON public.calls(caller_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON public.calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls(status);
CREATE INDEX IF NOT EXISTS idx_consent_requests_lookup ON public.consent_requests(requester_id, target_id, status);
CREATE INDEX IF NOT EXISTS idx_consent_requests_target ON public.consent_requests(target_id, status);

-- ------------------------------------------------------------------------------
-- HELPER FUNCTIONS FOR PRIVACY GATING
-- ------------------------------------------------------------------------------

-- Check if viewer has active diamond tier subscription
CREATE OR REPLACE FUNCTION public.has_active_diamond_subscription(viewer_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE profile_id = viewer_id
          AND tier = 'diamond'
          AND status = 'active'
          AND (current_period_end IS NULL OR current_period_end > now())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if 2-way photo consent has been accepted between two profiles
CREATE OR REPLACE FUNCTION public.has_accepted_photo_consent(viewer_id UUID, target_profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF viewer_id = target_profile_id THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.consent_requests
        WHERE status = 'accepted'
          AND (
            (requester_id = viewer_id AND target_id = target_profile_id)
            OR
            (requester_id = target_profile_id AND target_id = viewer_id)
          )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------------------------
-- SECURE VIEW: public.profiles_secure_view
-- Exposes avatar_url only if 2-way consent accepted or self.
-- Exposes wali_email only if viewer has active diamond subscription or self.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.profiles_secure_view AS
SELECT 
    p.id,
    p.full_name,
    CASE 
        WHEN auth.uid() = p.id THEN p.avatar_url
        WHEN public.has_accepted_photo_consent(auth.uid(), p.id) THEN p.avatar_url
        ELSE NULL
    END AS avatar_url,
    CASE 
        WHEN auth.uid() = p.id THEN p.wali_email
        WHEN public.has_active_diamond_subscription(auth.uid()) THEN p.wali_email
        ELSE NULL
    END AS wali_email,
    p.kyc_status,
    p.subscription_tier,
    p.is_test,
    p.created_at,
    p.updated_at
FROM public.profiles p;

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_requests ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles can be viewed by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 2. Subscriptions Policies
CREATE POLICY "Users can view their own subscriptions"
    ON public.subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = profile_id);

CREATE POLICY "Users or Service Role can manage subscriptions"
    ON public.subscriptions FOR ALL
    TO authenticated
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- 3. Calls Policies (WebRTC Signaling)
CREATE POLICY "Participants can view their calls"
    ON public.calls FOR SELECT
    TO authenticated
    USING (
        auth.uid() = caller_id 
        OR auth.uid() = recipient_id 
        OR auth.uid() = callee_id
    );

CREATE POLICY "Callers can insert calls"
    ON public.calls FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Participants can update their calls"
    ON public.calls FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = caller_id 
        OR auth.uid() = recipient_id 
        OR auth.uid() = callee_id
    )
    WITH CHECK (
        auth.uid() = caller_id 
        OR auth.uid() = recipient_id 
        OR auth.uid() = callee_id
    );

-- 4. Consent Requests Policies (2-Way Photo Privacy)
CREATE POLICY "Users can view consent requests involving them"
    ON public.consent_requests FOR SELECT
    TO authenticated
    USING (
        auth.uid() = requester_id 
        OR auth.uid() = target_id
    );

CREATE POLICY "Users can create consent requests"
    ON public.consent_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Target users or requesters can update consent request status"
    ON public.consent_requests FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = target_id 
        OR auth.uid() = requester_id
    )
    WITH CHECK (
        auth.uid() = target_id 
        OR auth.uid() = requester_id
    );

-- ------------------------------------------------------------------------------
-- REALTIME WEBHOOK & WEBSOCKET PUBLICATION (SUPABASE REALTIME)
-- ------------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consent_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;

-- ------------------------------------------------------------------------------
-- AUTH HOOK: AUTOMATIC PROFILE CREATION ON SIGNUP
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url, wali_email, kyc_status, subscription_tier, is_test)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Member'),
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'wali_email',
        'unverified',
        'free',
        false
    );

    -- Create initial free subscription
    INSERT INTO public.subscriptions (profile_id, tier, billing_cycle, status, current_period_start, current_period_end)
    VALUES (
        NEW.id,
        'free',
        'monthly',
        'active',
        now(),
        NULL
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
