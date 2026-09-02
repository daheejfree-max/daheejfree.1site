-- ==============================================================================
-- AUTOMATED MIGRATION: MESSAGES TABLE WITH RLS & REALTIME REPLICATION
-- DaheejFree Real-Time Islamic Matrimonial Messaging Engine
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create messages table with exact required specifications
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Backwards compatibility alias
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_nsfw BOOLEAN NOT NULL DEFAULT false,
    moderation_flagged BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist if table was previously created with older schema
DO $$ 
BEGIN 
    -- Add receiver_id if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'receiver_id'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
        -- Backfill receiver_id from recipient_id if available
        UPDATE public.messages SET receiver_id = recipient_id WHERE receiver_id IS NULL AND recipient_id IS NOT NULL;
    END IF;

    -- Add recipient_id alias if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'recipient_id'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
        UPDATE public.messages SET recipient_id = receiver_id WHERE recipient_id IS NULL AND receiver_id IS NOT NULL;
    END IF;

    -- Add is_read if not present
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'is_read'
    ) THEN
        ALTER TABLE public.messages ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- 2. Indexes for fast query retrieval
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON public.messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to prevent conflicts and ensure strict correctness
DROP POLICY IF EXISTS "Users can view messages where they are sender or receiver" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own sent messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update is_read status for their received messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages if within limits and not banned" ON public.messages;

-- RLS Policy A: SELECT (Read messages where authenticated user is either sender or receiver)
CREATE POLICY "Users can view messages where they are sender or receiver"
ON public.messages FOR SELECT
TO authenticated
USING (
    auth.uid() = sender_id 
    OR auth.uid() = receiver_id 
    OR auth.uid() = recipient_id
);

-- RLS Policy B: INSERT (Authenticated users can only insert messages as themselves)
CREATE POLICY "Users can insert their own sent messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = sender_id
);

-- RLS Policy C: UPDATE (Receiver can mark received messages as read)
CREATE POLICY "Users can update is_read status for their received messages"
ON public.messages FOR UPDATE
TO authenticated
USING (
    auth.uid() = receiver_id 
    OR auth.uid() = recipient_id
)
WITH CHECK (
    auth.uid() = receiver_id 
    OR auth.uid() = recipient_id
);

-- 5. Enable Realtime on the messages table
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
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
        -- Safely ignore if publication permissions or table already member
        RAISE NOTICE 'Publication setup handled: %', SQLERRM;
END $$;
