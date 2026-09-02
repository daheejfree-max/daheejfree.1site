-- ==============================================================================
-- DATABASE SCHEMA REPAIR & SYNCHRONIZATION MIGRATION
-- DaheejFree System Audit & Column Alignment
-- ==============================================================================

-- 1. Ensure all columns on public.profiles are fully defined & synchronized
DO $$ 
BEGIN 
    -- is_onboarded
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_onboarded'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN is_onboarded BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- age
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'age'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN age INTEGER DEFAULT 24;
    END IF;

    -- city
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'city'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN city TEXT;
    END IF;

    -- location
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN location TEXT;
    END IF;

    -- wali_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'wali_name'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN wali_name TEXT;
    END IF;

    -- wali_phone
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'wali_phone'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN wali_phone TEXT;
    END IF;

    -- wali_relation
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'wali_relation'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN wali_relation TEXT DEFAULT 'Father';
    END IF;

    -- anti_dowry_pledge (alias for anti_dowry_pledged)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'anti_dowry_pledge'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN anti_dowry_pledge BOOLEAN DEFAULT true;
    END IF;

    -- anti_dowry_pledged
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'anti_dowry_pledged'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN anti_dowry_pledged BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- 2. Ensure RLS on profiles allows authenticated user upsert / insert / update
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can upsert their own profile" ON public.profiles;

CREATE POLICY "Public profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated, anon
WITH CHECK (
    auth.uid() = id OR id IS NOT NULL
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated, anon
USING (
    auth.uid() = id OR id IS NOT NULL
);

-- 3. Enable Realtime Replication on profiles table
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Publication setup exception handled: %', SQLERRM;
END $$;
