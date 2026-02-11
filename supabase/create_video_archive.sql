-- Video Archive Table
-- Stores metadata for YouTube videos from The Power House International channel
-- Videos can be embedded from YouTube or streamed from Cloudflare R2

CREATE TABLE IF NOT EXISTS public.video_archive (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  youtube_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  r2_video_url TEXT, -- Optional: Cloudflare R2 URL if video is downloaded
  duration TEXT, -- e.g. "1:23:45" or "45:30"
  published_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  category TEXT DEFAULT 'sermon', -- sermon, worship, event, teaching, etc.
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_archive ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read videos
CREATE POLICY "Anyone can view videos"
  ON public.video_archive
  FOR SELECT
  USING (true);

-- Only service role can insert/update/delete (admin operations)
CREATE POLICY "Service role can manage videos"
  ON public.video_archive
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_video_archive_published_at ON public.video_archive(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_archive_category ON public.video_archive(category);
CREATE INDEX IF NOT EXISTS idx_video_archive_is_featured ON public.video_archive(is_featured) WHERE is_featured = true;
