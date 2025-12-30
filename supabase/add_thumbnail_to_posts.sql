-- Add thumbnail_url column to posts table for video thumbnails
ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN posts.thumbnail_url IS 'URL to video thumbnail image for share previews (used for video posts)';
