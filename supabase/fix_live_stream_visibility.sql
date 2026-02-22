-- FIX LIVE STREAM VISIBILITY AND REALTIME
-- Run this script in the Supabase Dashboard SQL Editor

BEGIN;

-- 1. Safely drop existing policies to prevent "already exists" errors
DROP POLICY IF EXISTS "Enable read access for all users" ON public.live_stream_config;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.live_stream_config;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.live_stream_config;

-- 2. Recreate policies to ensure everyone can read, and authenticated users can broadcast
CREATE POLICY "Enable read access for all users" ON public.live_stream_config
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.live_stream_config
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.live_stream_config
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 3. ENABLE REALTIME
-- This is critical: It tells Postgres to broadcast changes on this table to connected clients.
-- Without this, other users won't see the feed update when someone goes live!
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'live_stream_config') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE live_stream_config;
  END IF;
END $$;

COMMIT;
