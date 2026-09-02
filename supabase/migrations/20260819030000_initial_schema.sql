-- ==============================================================================
-- SUPABASE MIGRATION: INITIAL CORE PRODUCTION SCHEMA & SECURITY POLICIES
-- Generated: 2026-08-19
-- Tables: profiles, connections, messages
-- Features: Row Level Security (RLS), Realtime Replication, Storage Buckets
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. CORE TABLE: profiles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    gender TEXT,
    age INTEGER CHECK (age >= 18),
    profession TEXT,
    city TEXT,
    location TEXT,
    wali_name TEXT,
    wali_phone TEXT,
    anti_dowry_pledge BOOLEAN DEFAULT false,
    anti_dowry_pledged BOOLEAN DEFAULT false,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'emerald', 'diamond')),
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('unverified', 'pending', 'verified', 'rejected', 'banned')),
    kyc_session_id TEXT,
    is_admin BOOLEAN DEFAULT false,
    is_banned BOOLEAN DEFAULT false,
    is_onboarded BOOLEAN DEFAULT false,
    avatar_url TEXT,
    photo_privacy BOOLEAN DEFAULT true,
    photo_blur_hash TEXT DEFAULT 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexing for high-performance matchmaking and filtering
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON public.profiles(gender);
CREATE INDEX IF NOT EXISTS idx_profiles_kyc_status ON public.profiles(kyc_status);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON public.profiles(subscription_tier);

-- ------------------------------------------------------------------------------
-- 2. CORE TABLE: connections
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_connection_pair UNIQUE (sender_id, receiver_id),
    CONSTRAINT chk_no_self_connection CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_sender ON public.connections(sender_id);
CREATE INDEX IF NOT EXISTS idx_connections_receiver ON public.connections(receiver_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON public.connections(status);

-- ------------------------------------------------------------------------------
-- 3. CORE TABLE: messages
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    media_url TEXT,
    media_type TEXT,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT chk_message_content_or_media CHECK (content IS NOT NULL OR media_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, receiver_id, created_at);

-- ------------------------------------------------------------------------------
-- 4. REALTIME REPLICATION CONFIGURATION
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- Set replica identity to FULL for realtime change detection
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.connections REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- A. Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
    ON public.profiles
    FOR DELETE
    USING (auth.uid() = id);

-- B. Connections RLS
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view connections" ON public.connections;
CREATE POLICY "Participants can view connections"
    ON public.connections
    FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert connections as sender" ON public.connections;
CREATE POLICY "Users can insert connections as sender"
    ON public.connections
    FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Participants can update connections" ON public.connections;
CREATE POLICY "Participants can update connections"
    ON public.connections
    FOR UPDATE
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Participants can delete connections" ON public.connections;
CREATE POLICY "Participants can delete connections"
    ON public.connections
    FOR DELETE
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- C. Messages RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages"
    ON public.messages
    FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert messages as sender" ON public.messages;
CREATE POLICY "Users can insert messages as sender"
    ON public.messages
    FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Receivers can update message read status" ON public.messages;
CREATE POLICY "Receivers can update message read status"
    ON public.messages
    FOR UPDATE
    USING (auth.uid() = receiver_id)
    WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Senders can delete their own messages" ON public.messages;
CREATE POLICY "Senders can delete their own messages"
    ON public.messages
    FOR DELETE
    USING (auth.uid() = sender_id);

-- ------------------------------------------------------------------------------
-- 6. STORAGE BUCKETS & STORAGE OBJECT POLICIES
-- ------------------------------------------------------------------------------

-- Create avatars and chat_media storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('avatars', 'avatars', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
    ('chat_media', 'chat_media', false, 104857600, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'audio/webm', 'audio/wav', 'audio/mpeg'])
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 1. Avatars: Public read
DROP POLICY IF EXISTS "Avatars Public Select" ON storage.objects;
CREATE POLICY "Avatars Public Select"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatars');

-- 2. Avatars: Authenticated upload/insert
DROP POLICY IF EXISTS "Avatars Authenticated Upload" ON storage.objects;
CREATE POLICY "Avatars Authenticated Upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars');

-- 3. Avatars: Authenticated update
DROP POLICY IF EXISTS "Avatars Authenticated Update" ON storage.objects;
CREATE POLICY "Avatars Authenticated Update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars' AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid() IS NOT NULL))
    WITH CHECK (bucket_id = 'avatars');

-- 4. Avatars: Authenticated delete
DROP POLICY IF EXISTS "Avatars Authenticated Delete" ON storage.objects;
CREATE POLICY "Avatars Authenticated Delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'avatars' AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.uid() IS NOT NULL));

-- 5. Chat Media: Authenticated read
DROP POLICY IF EXISTS "Chat Media Authenticated Select" ON storage.objects;
CREATE POLICY "Chat Media Authenticated Select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'chat_media');

-- 6. Chat Media: Authenticated insert
DROP POLICY IF EXISTS "Chat Media Authenticated Upload" ON storage.objects;
CREATE POLICY "Chat Media Authenticated Upload"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'chat_media');

-- ------------------------------------------------------------------------------
-- 7. AUTOMATIC USER PROFILE TRIGGER (auth.users -> public.profiles)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        gender,
        age,
        avatar_url,
        anti_dowry_pledge,
        subscription_tier,
        kyc_status,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New Member'),
        COALESCE(NEW.raw_user_meta_data->>'gender', 'female'),
        COALESCE((NEW.raw_user_meta_data->>'age')::INTEGER, 24),
        NEW.raw_user_meta_data->>'avatar_url',
        true,
        'free',
        'pending',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
