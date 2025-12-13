-- Update the file size limit for the 'media' bucket to 2GB
update storage.buckets
set file_size_limit = 2147483648
where id = 'media';

-- Also ensure it's public if needed, but mainly the size limit
-- 2GB = 2 * 1024 * 1024 * 1024 = 2147483648 bytes

-- If 'posts' bucket exists, update that too just in case
update storage.buckets
set file_size_limit = 2147483648
where id = 'posts';
