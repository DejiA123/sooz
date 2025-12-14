-- Enable the pg_cron extension
create extension if not exists pg_cron;

-- Schedule a daily keep-alive job
-- This runs 'SELECT 1' every day at 12:00 AM (00:00)
-- standard cron syntax: minute hour day month day_of_week
select cron.schedule(
  'keep_alive', -- name of the cron job
  '0 0 * * *',  -- runs every day at midnight
  $$select 1$$  -- query to run
);

-- To verify the job is scheduled, you can run:
-- select * from cron.job;

-- To unschedule/remove the job later:
-- select cron.unschedule('keep_alive');
