-- Create post views table
CREATE TABLE public.post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(post_id, user_id)
);

-- Enable RLS on post views table
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- Post views policies
CREATE POLICY "Post views are viewable by everyone" ON public.post_views FOR SELECT USING (true);
CREATE POLICY "Users can track their own views" ON public.post_views FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create index for efficient post views fetching
CREATE INDEX idx_post_views_post_id ON public.post_views(post_id);
CREATE INDEX idx_post_views_viewed_at ON public.post_views(viewed_at DESC);

-- Add view count column to posts table for caching
ALTER TABLE public.posts ADD COLUMN view_count INTEGER DEFAULT 0;

-- Create function to update view count
CREATE OR REPLACE FUNCTION update_post_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts 
  SET view_count = view_count + 1 
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update view count on new view
CREATE TRIGGER trigger_update_post_view_count
  AFTER INSERT ON public.post_views
  FOR EACH ROW
  EXECUTE FUNCTION update_post_view_count();