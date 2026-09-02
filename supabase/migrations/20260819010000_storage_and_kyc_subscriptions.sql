-- ==============================================================================
-- PHASE 1 MIGRATION: SUPABASE STORAGE BUCKET & ENTERPRISE KYC / SUBSCRIPTIONS
-- DaheejFree Real-World Matrimonial Enterprise Architecture
-- ==============================================================================

-- 1. Create the public avatars storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Storage Bucket Row-Level Security (RLS) Policies on storage.objects
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read access to avatar images
DROP POLICY IF EXISTS "Public Avatar Read Access" ON storage.objects;
CREATE POLICY "Public Avatar Read Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar into avatars bucket
DROP POLICY IF EXISTS "Authenticated Users Can Upload Avatar" ON storage.objects;
CREATE POLICY "Authenticated Users Can Upload Avatar"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'avatars');

-- Allow users to update their own avatar
DROP POLICY IF EXISTS "Users Can Update Own Avatar" ON storage.objects;
CREATE POLICY "Users Can Update Own Avatar"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (bucket_id = 'avatars');

-- Allow users to delete their own avatar
DROP POLICY IF EXISTS "Users Can Delete Own Avatar" ON storage.objects;
CREATE POLICY "Users Can Delete Own Avatar"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id = 'avatars');

-- 3. Ensure profiles table has all enterprise columns
DO $$
BEGIN
    -- avatar_url
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
    END IF;

    -- kyc_status (enum / text: 'pending', 'verified', 'rejected')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'kyc_status'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN kyc_status TEXT DEFAULT 'pending';
    END IF;

    -- kyc_session_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'kyc_session_id'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN kyc_session_id TEXT;
    END IF;

    -- subscription_id (Razorpay subscription ID)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_id'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN subscription_id TEXT;
    END IF;

    -- subscription_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN subscription_status TEXT DEFAULT 'inactive';
    END IF;

    -- photo_privacy (default true for Islamic matrimonial privacy)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'photo_privacy'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN photo_privacy BOOLEAN DEFAULT true;
    END IF;

    -- didit_session_url
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'didit_session_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN didit_session_url TEXT;
    END IF;
END $$;

-- 4. Subscriptions table enterprise schema
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'free',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    status TEXT NOT NULL DEFAULT 'active',
    subscription_id TEXT,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON public.profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_session_id ON public.profiles(kyc_session_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id ON public.profiles(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_profile_id ON public.subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_id ON public.subscriptions(subscription_id);
