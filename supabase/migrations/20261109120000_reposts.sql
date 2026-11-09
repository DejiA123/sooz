-- Reposts, like TikTok: share a SOOZ post or a Christian TikTok with your followers.
-- A reposted TikTok keeps a small copy of its details (tiktok jsonb) so it can be shown anywhere,
-- even if it isn't in the app's library.

create table if not exists public.reposts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  tiktok_id text check (tiktok_id is null or tiktok_id ~ '^[0-9]{5,25}$'),
  tiktok jsonb,
  created_at timestamptz not null default now(),
  constraint reposts_one_target check ((post_id is not null) <> (tiktok_id is not null))
);

create unique index if not exists reposts_user_post_idx on public.reposts (user_id, post_id) where post_id is not null;
create unique index if not exists reposts_user_tiktok_idx on public.reposts (user_id, tiktok_id) where tiktok_id is not null;
create index if not exists reposts_user_time_idx on public.reposts (user_id, created_at desc);
create index if not exists reposts_post_idx on public.reposts (post_id);
create index if not exists reposts_tiktok_idx on public.reposts (tiktok_id);

alter table public.reposts enable row level security;

drop policy if exists "Reposts are public" on public.reposts;
create policy "Reposts are public" on public.reposts for select using (true);

drop policy if exists "Members repost as themselves" on public.reposts;
create policy "Members repost as themselves" on public.reposts for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Members undo their own reposts" on public.reposts;
create policy "Members undo their own reposts" on public.reposts for delete to authenticated using (auth.uid() = user_id);

-- One number per post / TikTok.
create or replace view public.repost_counts
  with (security_invoker = true) as
  select coalesce(post_id::text, tiktok_id) as target, count(*)::integer as reposts
  from public.reposts
  group by 1;

grant select on public.repost_counts to anon, authenticated;
