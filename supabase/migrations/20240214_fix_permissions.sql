-- Enable RLS on video_archive if not already enabled
ALTER TABLE public.video_archive ENABLE ROW LEVEL SECURITY;

-- Allow public read access to video_archive
CREATE POLICY "Video archive is viewable by everyone" 
ON public.video_archive FOR SELECT 
USING (true);

-- Ensure post_views exists and has RLS enabled
-- (Assuming it might be created by a different process or manually)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'post_views') THEN
        ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
        
        -- Allow anonymous/public inserts for view tracking
        IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'post_views' AND policyname = 'Anyone can track views') THEN
            CREATE POLICY "Anyone can track views" 
            ON public.post_views FOR INSERT 
            WITH CHECK (true);
        END IF;

        -- Allow public to see view counts (if needed by frontend)
        IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'post_views' AND policyname = 'Post views are viewable by everyone') THEN
            CREATE POLICY "Post views are viewable by everyone" 
            ON public.post_views FOR SELECT 
            USING (true);
        END IF;
    END IF;
END $$;
