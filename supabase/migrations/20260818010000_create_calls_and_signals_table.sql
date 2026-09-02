-- ==============================================================================
-- AUTOMATED MIGRATION: CALLS & CALL SIGNALING REALTIME TABLES
-- DaheejFree WebRTC Voice & Video Calling Engine
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create calls table
CREATE TABLE IF NOT EXISTS public.calls (
    id TEXT PRIMARY KEY,
    caller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    callee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL DEFAULT 'video' CHECK (call_type IN ('audio', 'video', 'voice')),
    status TEXT NOT NULL DEFAULT 'connecting' CHECK (status IN ('connecting', 'ringing', 'active', 'completed', 'declined', 'missed')),
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'duration_seconds'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'calls' AND column_name = 'callee_id'
    ) THEN
        ALTER TABLE public.calls ADD COLUMN callee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
        UPDATE public.calls SET callee_id = recipient_id WHERE callee_id IS NULL;
    END IF;
END $$;

-- 2. Create call_signals table for fallback persistent SDP/ICE exchange
CREATE TABLE IF NOT EXISTS public.call_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id TEXT NOT NULL,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'candidate', 'call-ended', 'ring')),
    signal_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast signaling lookups & call history queries
CREATE INDEX IF NOT EXISTS idx_calls_caller ON public.calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_recipient ON public.calls(recipient_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON public.calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_signals_call_id ON public.call_signals(call_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_call_signals_receiver ON public.call_signals(receiver_id);

-- 3. Row Level Security (RLS)
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view calls where they are caller or recipient" ON public.calls;
DROP POLICY IF EXISTS "Users can insert calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update their calls" ON public.calls;

DROP POLICY IF EXISTS "Users can view signals for them or by them" ON public.call_signals;
DROP POLICY IF EXISTS "Users can insert call signals" ON public.call_signals;

-- Calls Policies
CREATE POLICY "Users can view calls where they are caller or recipient"
ON public.calls FOR SELECT
TO authenticated
USING (
    auth.uid() = caller_id 
    OR auth.uid() = recipient_id 
    OR auth.uid() = callee_id
);

CREATE POLICY "Users can insert calls"
ON public.calls FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = caller_id
);

CREATE POLICY "Users can update their calls"
ON public.calls FOR UPDATE
TO authenticated
USING (
    auth.uid() = caller_id 
    OR auth.uid() = recipient_id 
    OR auth.uid() = callee_id
);

-- Call Signals Policies
CREATE POLICY "Users can view signals for them or by them"
ON public.call_signals FOR SELECT
TO authenticated
USING (
    auth.uid() = receiver_id 
    OR auth.uid() = sender_id
);

CREATE POLICY "Users can insert call signals"
ON public.call_signals FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = sender_id
);

-- 4. Enable Realtime Replication for instant signaling
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER TABLE public.call_signals REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'calls'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'call_signals'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Publication setup exception handled: %', SQLERRM;
END $$;
