create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'sooz-sync-youtube-archive';
select cron.schedule(
  'sooz-sync-youtube-archive',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://xhqpojnmcibkaydidnex.supabase.co/functions/v1/sync-youtube-archive',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhocXBvam5tY2lia2F5ZGlkbmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMjAzNTcsImV4cCI6MjA4MDg5NjM1N30.DkKg7S_xOEyGR2R9TtjBKzqoDACzZUYkA8BcFw6qylw"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);