-- SOOZ comments on TikToks + share counts for posts.
--
-- SOOZ's own comments on Christian TikToks in the feed (TikTok has no public API for its comments,
-- so SOOZ members discuss each TikTok inside SOOZ). Keyed by the TikTok video id, because the
-- built-in starter videos are not rows in tiktok_videos.

create table if not exists public.tiktok_comments (
  id uuid primary key default gen_random_uuid(),
  tiktok_id text not null check (tiktok_id ~ '^[0-9]{5,25}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.tiktok_comments(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists tiktok_comments_video_idx on public.tiktok_comments (tiktok_id, created_at desc);
create index if not exists tiktok_comments_parent_idx on public.tiktok_comments (parent_id);

alter table public.tiktok_comments enable row level security;

drop policy if exists "TikTok comments are public" on public.tiktok_comments;
create policy "TikTok comments are public"
  on public.tiktok_comments for select
  using (true);

drop policy if exists "Members add their own TikTok comments" on public.tiktok_comments;
create policy "Members add their own TikTok comments"
  on public.tiktok_comments for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Members delete their own TikTok comments" on public.tiktok_comments;
create policy "Members delete their own TikTok comments"
  on public.tiktok_comments for delete to authenticated
  using (auth.uid() = user_id);

-- New comments appear live for everyone viewing the same TikTok.
do $$
begin
  alter publication supabase_realtime add table public.tiktok_comments;
exception when duplicate_object then null;
end $$;

-- Share counts for SOOZ posts (shown under the share arrow, like TikTok). One row per share.
create table if not exists public.post_shares (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists post_shares_post_idx on public.post_shares (post_id);

alter table public.post_shares enable row level security;

drop policy if exists "Post shares are public" on public.post_shares;
create policy "Post shares are public"
  on public.post_shares for select
  using (true);

drop policy if exists "Members record their own shares" on public.post_shares;
create policy "Members record their own shares"
  on public.post_shares for insert to authenticated
  with check (auth.uid() = user_id);

-- One number per post, so the feed doesn't download every share.
create or replace view public.post_share_counts
  with (security_invoker = true) as
  select post_id, count(*)::integer as shares
  from public.post_shares
  group by post_id;

grant select on public.post_share_counts to anon, authenticated;
