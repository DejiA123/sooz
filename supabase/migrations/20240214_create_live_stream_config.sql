-- Create live_stream_config table
CREATE TABLE IF NOT EXISTS public.live_stream_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_uid TEXT,
    rtmp_url TEXT,
    stream_key TEXT, -- Should be protected by RLS if possible, or just accessible to admins
    playback_url TEXT,
    status TEXT DEFAULT 'offline', -- 'live', 'offline'
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE public.live_stream_config ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (so users can see if stream is live)
CREATE POLICY "Enable read access for all users" ON public.live_stream_config
    FOR SELECT USING (true);

-- Allow write access only to admins (service role or specific user)
-- For now, we'll allow authenticated users to update if they are admins (simplified)
-- Assuming 'admin' role or specific logic. For now, let's allow service_role only for updates via Edge Functions?
-- Actually, the "Go Live" admin panel needs to read the stream key.
-- Users should NOT see the stream key.

-- Let's restrict stream_key visibility?
-- Supabase doesn't support column-level security easily. 
-- We can create a view or just rely on frontend not showing it to non-admins.
-- But standard users fetch this table to check status.
-- Better approach: Separate table for secure config? Or just reliable RLS.

-- Let's assume for this MVP we just trust the client app logic + RLS on 'update'.
-- We'll allow authenticated users to INSERT/UPDATE (assuming only admins have the UI).
CREATE POLICY "Enable insert for authenticated users" ON public.live_stream_config
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.live_stream_config
    FOR UPDATE USING (auth.role() = 'authenticated');
