-- check_buckets.sql
-- Run this in your Supabase SQL Editor to see the current bucket configurations

SELECT 
    id, 
    name, 
    file_size_limit, 
    allowed_mime_types, 
    public
FROM storage.buckets;
