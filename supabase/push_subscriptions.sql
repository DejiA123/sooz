-- Create table for storing push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_used timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Policies
create policy "Users can insert their own subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role can read all subscriptions"
  on public.push_subscriptions for select
  using (auth.role() = 'service_role');

-- Create function to trigger push notification on new post
-- Note: This requires the Edge Function to be deployed first
-- create trigger on_new_post_push
-- after insert on public.posts
-- for each row execute function supabase_functions.http_request('http://localhost:54321/functions/v1/push-notifications', 'POST', '{"record":' || row_to_json(NEW) || '}');
