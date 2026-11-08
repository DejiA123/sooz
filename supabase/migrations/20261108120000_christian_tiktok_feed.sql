-- Christian TikTok videos shown in the SOOZ feed through TikTok's official embed player.
--
-- TikTok has no public API that lists videos by topic, so content is curated:
--   * anyone signed in can suggest a TikTok link (it waits for review),
--   * curators' links and links from trusted Christian creators are approved straight away,
--   * every link is checked server-side by the `tiktok-import` edge function, which reads the
--     real caption/creator from TikTok's oEmbed endpoint and runs a faith keyword filter.
-- Only rows with status = 'approved' are ever shown in the feed.
--
-- To make yourself a curator, run once in the SQL editor (replace the username):
--   insert into public.tiktok_curators (user_id)
--   select id from public.profiles where username = 'YOUR_USERNAME';

create table if not exists public.tiktok_videos (
  id uuid primary key default gen_random_uuid(),
  tiktok_id text not null unique,
  url text not null,
  author_name text,
  author_handle text,
  author_url text,
  title text,
  thumbnail_url text,
  thumbnail_width integer,
  thumbnail_height integer,
  faith_tags text[] not null default '{}',
  status text not null default 'pending' check (status in ('approved', 'pending', 'rejected')),
  review_note text,
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  metadata_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tiktok_videos_approved_created
  on public.tiktok_videos (created_at desc) where status = 'approved';
create index if not exists idx_tiktok_videos_status on public.tiktok_videos (status);
create index if not exists idx_tiktok_videos_submitted_by on public.tiktok_videos (submitted_by);

create table if not exists public.tiktok_curators (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- TikTok handles (lowercase, no @) whose videos are approved without manual review.
create table if not exists public.tiktok_trusted_creators (
  handle text primary key check (handle = lower(handle) and handle !~ '^@'),
  note text,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.is_tiktok_curator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.tiktok_curators where user_id = uid);
$$;

alter table public.tiktok_videos enable row level security;
alter table public.tiktok_curators enable row level security;
alter table public.tiktok_trusted_creators enable row level security;

drop policy if exists "Approved TikTok videos are public" on public.tiktok_videos;
create policy "Approved TikTok videos are public"
  on public.tiktok_videos for select
  using (
    status = 'approved'
    or submitted_by = auth.uid()
    or public.is_tiktok_curator(auth.uid())
  );

drop policy if exists "Curators review TikTok videos" on public.tiktok_videos;
create policy "Curators review TikTok videos"
  on public.tiktok_videos for update
  using (public.is_tiktok_curator(auth.uid()))
  with check (public.is_tiktok_curator(auth.uid()));

drop policy if exists "Curators remove TikTok videos" on public.tiktok_videos;
create policy "Curators remove TikTok videos"
  on public.tiktok_videos for delete
  using (public.is_tiktok_curator(auth.uid()));
-- Inserts happen only through the tiktok-import edge function (service role), so the stored
-- caption and creator always come from TikTok itself and cannot be faked by a client.

drop policy if exists "Users can see their own curator row" on public.tiktok_curators;
create policy "Users can see their own curator row"
  on public.tiktok_curators for select
  using (user_id = auth.uid() or public.is_tiktok_curator(auth.uid()));

drop policy if exists "Curators read trusted creators" on public.tiktok_trusted_creators;
create policy "Curators read trusted creators"
  on public.tiktok_trusted_creators for select
  using (public.is_tiktok_curator(auth.uid()));

drop policy if exists "Curators manage trusted creators" on public.tiktok_trusted_creators;
create policy "Curators manage trusted creators"
  on public.tiktok_trusted_creators for all
  using (public.is_tiktok_curator(auth.uid()))
  with check (public.is_tiktok_curator(auth.uid()));
