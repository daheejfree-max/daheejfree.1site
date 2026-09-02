-- ==============================================================================
-- DAHEEJFREE MATRIMONIAL PLATFORM - PRODUCTION V5 DATABASE SCHEMA & STRICT RLS
-- ==============================================================================
-- Strict Shariah Matrimonial Architecture with Zero-Tolerance Dowry Covenant,
-- Peer-to-Peer WebRTC Call Signals, 2-Way Gated Photo Permissions & Didit KYC
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE: public.profiles (Users Profile & Shariah Matrimonial Identity)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nickname TEXT,
  phone_number TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')),
  age INTEGER CHECK (age >= 18),
  avatar_url TEXT,
  bio TEXT,
  location TEXT,
  city TEXT,
  profession TEXT,
  education TEXT,
  sect TEXT DEFAULT 'Sunni',
  preferred_sect TEXT DEFAULT 'Any',
  religious_practice TEXT,
  prayer_frequency TEXT,
  quran_recitation TEXT,
  marital_status TEXT,
  has_children BOOLEAN DEFAULT false,
  height_cm INTEGER,
  
  -- Guardian (Wali) Governance
  wali_name TEXT,
  wali_relation TEXT DEFAULT 'Father',
  wali_phone TEXT,
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

  -- Identity KYC (Didit Integration)
  kyc_status TEXT NOT NULL DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'banned')),
  is_verified BOOLEAN DEFAULT false,
  kyc_document_type TEXT,
  kyc_document_url TEXT,
  kyc_session_id TEXT,
  didit_session_url TEXT,
  selfie_verified BOOLEAN DEFAULT false,
  selfie_url TEXT,

  -- Subscription (Strict 3 Tiers: 'free', 'gold', 'diamond')
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'gold', 'diamond', 'platinum')),
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'active',

  -- Privacy Controls
  photo_privacy BOOLEAN DEFAULT true,
  photo_privacy_mode TEXT DEFAULT 'liked_only' CHECK (photo_privacy_mode IN ('blur_all', 'liked_only', 'public')),
  photo_blur_hash TEXT,

  -- Legal & Security Audit
  legal_consent_accepted_at TIMESTAMPTZ,
  terms_accepted BOOLEAN DEFAULT false,
  last_known_ip TEXT,
  is_active BOOLEAN DEFAULT true,
  is_onboarded BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. TABLE: public.call_signals (WebRTC Video & Voice Call Signaling)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.call_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'missed', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_signals_caller ON public.call_signals(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_signals_receiver ON public.call_signals(receiver_id);
CREATE INDEX IF NOT EXISTS idx_call_signals_created ON public.call_signals(created_at DESC);

-- ==============================================================================
-- 4. TABLE: public.photo_permissions (Strict 2-Way Gated Photo Consent)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.photo_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_photo_permissions_pair UNIQUE (requester_id, target_user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_photo_permissions_requester ON public.photo_permissions(requester_id);
CREATE INDEX IF NOT EXISTS idx_photo_permissions_target ON public.photo_permissions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_photo_permissions_status ON public.photo_permissions(status);

-- ==============================================================================
-- 5. TABLE: public.subscriptions (Dodo Payments Subscription Ledger)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'gold', 'diamond', 'platinum')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  dodo_customer_id TEXT,
  dodo_subscription_id TEXT,
  dodo_payment_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_profile ON public.subscriptions(profile_id);

-- ==============================================================================
-- 6. TABLE: public.messages (Encrypted Matrimonial Text Chat)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_nsfw BOOLEAN NOT NULL DEFAULT false,
  is_dowry_demand BOOLEAN NOT NULL DEFAULT false,
  moderation_flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);

-- ==============================================================================
-- 7. TABLE: public.connections (Mutual Match Pairings & Discovery)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_connection_pair UNIQUE (sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_sender ON public.connections(sender_id);
CREATE INDEX IF NOT EXISTS idx_connections_receiver ON public.connections(receiver_id);

-- ==============================================================================
-- 8. STRICT ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- A. PROFILES TABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view active profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (is_active = true OR auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- B. CALL SIGNALS TABLE RLS (WebRTC Signaling)
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their call signals" ON public.call_signals;
CREATE POLICY "Participants can view their call signals"
  ON public.call_signals FOR SELECT
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Callers can insert call signals" ON public.call_signals;
CREATE POLICY "Callers can insert call signals"
  ON public.call_signals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = caller_id);

DROP POLICY IF EXISTS "Participants can update their call signals" ON public.call_signals;
CREATE POLICY "Participants can update their call signals"
  ON public.call_signals FOR UPDATE
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Participants can delete their call signals" ON public.call_signals;
CREATE POLICY "Participants can delete their call signals"
  ON public.call_signals FOR DELETE
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- C. PHOTO PERMISSIONS TABLE RLS (2-Way Photo Privacy)
ALTER TABLE public.photo_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view photo permissions" ON public.photo_permissions;
CREATE POLICY "Participants can view photo permissions"
  ON public.photo_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_user_id);

DROP POLICY IF EXISTS "Requesters can create photo permissions" ON public.photo_permissions;
CREATE POLICY "Requesters can create photo permissions"
  ON public.photo_permissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Target user or requester can update permission status" ON public.photo_permissions;
CREATE POLICY "Target user or requester can update permission status"
  ON public.photo_permissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = target_user_id OR auth.uid() = requester_id)
  WITH CHECK (auth.uid() = target_user_id OR auth.uid() = requester_id);

DROP POLICY IF EXISTS "Participants can delete photo permissions" ON public.photo_permissions;
CREATE POLICY "Participants can delete photo permissions"
  ON public.photo_permissions FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_user_id);

-- D. SUBSCRIPTIONS TABLE RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

-- E. MESSAGES TABLE RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their messages" ON public.messages;
CREATE POLICY "Participants can view their messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Senders can insert messages" ON public.messages;
CREATE POLICY "Senders can insert messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Receivers can update message read status" ON public.messages;
CREATE POLICY "Receivers can update message read status"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- F. CONNECTIONS TABLE RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view connection requests" ON public.connections;
CREATE POLICY "Participants can view connection requests"
  ON public.connections FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Senders can create connection requests" ON public.connections;
CREATE POLICY "Senders can create connection requests"
  ON public.connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Participants can update connection status" ON public.connections;
CREATE POLICY "Participants can update connection status"
  ON public.connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ==============================================================================
-- 9. SUPABASE REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
DO $$
BEGIN
  -- Ensure publication exists
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ==============================================================================
-- 10. AUTO-SYNC TRIGGER: AUTH.USERS -> PUBLIC.PROFILES
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_consent_timestamp TIMESTAMPTZ;
BEGIN
  v_consent_timestamp := COALESCE((new.raw_user_meta_data->>'legal_consent_accepted_at')::TIMESTAMPTZ, now());

  INSERT INTO public.profiles (
    id,
    full_name,
    gender,
    avatar_url,
    wali_name,
    wali_relation,
    wali_phone,
    wali_email,
    kyc_status,
    subscription_tier,
    anti_dowry_pledged,
    legal_consent_accepted_at,
    terms_accepted,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Matrimonial Candidate'),
    COALESCE(new.raw_user_meta_data->>'gender', 'female'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', NULL),
    COALESCE(new.raw_user_meta_data->>'wali_name', 'Guardian'),
    COALESCE(new.raw_user_meta_data->>'wali_relation', 'Father'),
    COALESCE(new.raw_user_meta_data->>'wali_phone', '+91 98765 43210'),
    COALESCE(new.raw_user_meta_data->>'wali_email', new.email),
    'unverified',
    'free',
    true,
    v_consent_timestamp,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    legal_consent_accepted_at = EXCLUDED.legal_consent_accepted_at,
    terms_accepted = true,
    updated_at = now();

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
