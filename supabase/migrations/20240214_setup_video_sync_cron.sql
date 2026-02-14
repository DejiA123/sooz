-- Enable the required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Note: In Supabase, the cron jobs are stored in the 'cron' schema.
-- We schedule the job to run every hour.
-- Replace [YOUR_PROJECT_REF] with your actual project reference if running manually.

SELECT
  cron.schedule(
    'sync-youtube-archive-every-hour', -- name of the cron job
    '0 * * * *',                       -- every hour (cron syntax)
    $$
    SELECT
      net.http_post(
        url:='https://' || (SELECT (string_to_array(Deno.env.get('SUPABASE_URL'), '.'))[1] FROM profiles LIMIT 1) || '.supabase.co/functions/v1/sync-youtube-archive',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '"}'::jsonb,
        body:='{}'::jsonb
      )
    $$
  );

-- IMPORTANT: The above SQL uses Deno.env which isn't available in standard SQL.
-- For a real Supabase setup, you would typically use the actual URL and Service Role Key
-- or store them in a secure vault/table.

-- Here is the standard version for manual execution or migration (replace placeholders):
/*
SELECT
  cron.schedule(
    'sync-youtube-archive-every-hour',
    '0 * * * *',
    $$
    SELECT
      net.http_post(
        url:='https://[PROJECT_REF].supabase.co/functions/v1/sync-youtube-archive',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb,
        body:='{}'::jsonb
      )
    $$
  );
*/
