-- ==============================================================================
-- PHASE 1 MIGRATION: MUTUAL CONNECTIONS & MATCHING TABLE
-- DaheejFree Real-time Matrimonial Match & Feature Gating System
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create connections table for mutual matching
CREATE TABLE IF NOT EXISTS public.connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_connection_pair UNIQUE(sender_id, receiver_id),
    CONSTRAINT no_self_connection CHECK (sender_id <> receiver_id)
);

-- Indexes for ultra-fast matching lookups
CREATE INDEX IF NOT EXISTS idx_connections_sender ON public.connections(sender_id);
CREATE INDEX IF NOT EXISTS idx_connections_receiver ON public.connections(receiver_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON public.connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_pair ON public.connections(sender_id, receiver_id);

-- 2. Row Level Security (RLS)
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own connections" ON public.connections;
DROP POLICY IF EXISTS "Users can send connection requests" ON public.connections;
DROP POLICY IF EXISTS "Users can update their received or sent connections" ON public.connections;
DROP POLICY IF EXISTS "Users can delete their connections" ON public.connections;

CREATE POLICY "Users can view their own connections"
ON public.connections FOR SELECT
TO authenticated, anon
USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id OR auth.uid() IS NULL
);

CREATE POLICY "Users can send connection requests"
ON public.connections FOR INSERT
TO authenticated, anon
WITH CHECK (
    auth.uid() = sender_id OR auth.uid() IS NULL
);

CREATE POLICY "Users can update their received or sent connections"
ON public.connections FOR UPDATE
TO authenticated, anon
USING (
    auth.uid() = receiver_id OR auth.uid() = sender_id OR auth.uid() IS NULL
);

CREATE POLICY "Users can delete their connections"
ON public.connections FOR DELETE
TO authenticated, anon
USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id OR auth.uid() IS NULL
);

-- 3. Ensure messages table is permanent & persistent
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id TEXT,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_nsfw BOOLEAN DEFAULT false,
    is_dowry_demand BOOLEAN DEFAULT false,
    moderation_flagged BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Populate receiver_id if legacy recipient_id was used
DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'recipient_id'
    ) THEN
        UPDATE public.messages SET receiver_id = recipient_id WHERE receiver_id IS NULL;
    END IF;
END $$;

-- 4. Enable Realtime Replication for instant matching & chat feeds
ALTER TABLE public.connections REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'connections'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Publication setup exception handled: %', SQLERRM;
END $$;
