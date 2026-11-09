-- Safety (reporting, moderation, family-safe mode) and For You taste saved to the account.

-- ── Moderators: SOOZ's admins ────────────────────────────────────────
create table if not exists public.app_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_moderators enable row level security;
drop policy if exists "Moderators see themselves" on public.app_moderators;
create policy "Moderators see themselves" on public.app_moderators for select using (auth.uid() = user_id);
insert into public.app_moderators (user_id)
  select id from auth.users where id = '30a23fee-dcc0-49fd-82c9-a3b2a7fa3927'
  on conflict do nothing;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_moderators where user_id = auth.uid());
$$;

-- ── Hidden content: moderated items disappear for everyone but their author and moderators ──
alter table public.posts add column if not exists hidden boolean not null default false;
alter table public.comments add column if not exists hidden boolean not null default false;
alter table public.tiktok_comments add column if not exists hidden boolean not null default false;

drop policy if exists "Hidden posts only for author and moderators" on public.posts;
create policy "Hidden posts only for author and moderators" on public.posts as restrictive for select
  using (not hidden or auth.uid() = user_id or public.is_moderator());
drop policy if exists "Hidden comments only for author and moderators" on public.comments;
create policy "Hidden comments only for author and moderators" on public.comments as restrictive for select
  using (not hidden or auth.uid() = user_id or public.is_moderator());
drop policy if exists "Hidden TikTok comments only for author and moderators" on public.tiktok_comments;
create policy "Hidden TikTok comments only for author and moderators" on public.tiktok_comments as restrictive for select
  using (not hidden or auth.uid() = user_id or public.is_moderator());

-- ── TikToks taken out by moderators (the library lives on GitHub; this hides them for everyone) ──
create table if not exists public.blocked_tiktoks (
  key text primary key,              -- a video id, or "@handle" for a whole creator
  reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.blocked_tiktoks enable row level security;
drop policy if exists "Everyone can read blocked TikToks" on public.blocked_tiktoks;
create policy "Everyone can read blocked TikToks" on public.blocked_tiktoks for select using (true);
drop policy if exists "Moderators manage blocked TikToks" on public.blocked_tiktoks;
create policy "Moderators manage blocked TikToks" on public.blocked_tiktoks for all using (public.is_moderator()) with check (public.is_moderator());

-- ── Reports ─────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'tiktok', 'tiktok_comment', 'user', 'message', 'story')),
  target_id text not null,
  target_owner uuid,
  -- What was reported, as the reporter saw it (moderators can't read other people's chats).
  snapshot text check (char_length(snapshot) <= 2000),
  reason text not null check (reason in ('sexual', 'child_safety', 'hate', 'violence', 'self_harm', 'false_teaching', 'spam', 'not_christian', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  unique (reporter_id, target_type, target_id)
);
create index if not exists reports_open_idx on public.reports (status, created_at desc);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
alter table public.reports enable row level security;
drop policy if exists "Members report as themselves" on public.reports;
create policy "Members report as themselves" on public.reports for insert with check (auth.uid() = reporter_id);
drop policy if exists "Reporters and moderators see reports" on public.reports;
create policy "Reporters and moderators see reports" on public.reports for select using (auth.uid() = reporter_id or public.is_moderator());
drop policy if exists "Moderators resolve reports" on public.reports;
create policy "Moderators resolve reports" on public.reports for update using (public.is_moderator());

-- Hide reported content straight away until a moderator looks: after one report for sexual content or
-- child safety, after three different people for anything else.
create or replace function public.reports_auto_hide()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  people int;
begin
  select count(distinct reporter_id) into people from public.reports
    where target_type = new.target_type and target_id = new.target_id and status = 'open';
  if new.reason in ('sexual', 'child_safety') or people >= 3 then
    if new.target_type = 'post' then
      update public.posts set hidden = true where id::text = new.target_id;
    elsif new.target_type = 'comment' then
      update public.comments set hidden = true where id::text = new.target_id;
    elsif new.target_type = 'tiktok_comment' then
      update public.tiktok_comments set hidden = true where id::text = new.target_id;
    elsif new.target_type = 'tiktok' then
      insert into public.blocked_tiktoks (key, reason, created_by) values (new.target_id, 'reported: ' || new.reason, null)
        on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide after insert on public.reports for each row execute function public.reports_auto_hide();

-- Items with open reports (not who reported them): family-safe mode leaves these out.
create or replace function public.reported_items()
returns table (target_type text, target_id text) language sql stable security definer set search_path = public as $$
  select distinct r.target_type, r.target_id from public.reports r where r.status = 'open';
$$;
grant execute on function public.reported_items() to anon, authenticated;

-- A moderator's decision on everything reported about one item.
--   hide: hidden for everyone (TikToks: taken out of the feed; users: all their posts hidden)
--   remove: deleted (posts and comments)
--   keep: reports dismissed and the item shown again
create or replace function public.moderate(p_type text, p_id text, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'Only moderators can do this'; end if;
  if p_action not in ('hide', 'remove', 'keep') then raise exception 'Unknown action %', p_action; end if;

  if p_type = 'post' then
    if p_action = 'remove' then delete from public.posts where id::text = p_id;
    else update public.posts set hidden = (p_action = 'hide') where id::text = p_id; end if;
  elsif p_type = 'comment' then
    if p_action = 'remove' then delete from public.comments where id::text = p_id;
    else update public.comments set hidden = (p_action = 'hide') where id::text = p_id; end if;
  elsif p_type = 'tiktok_comment' then
    if p_action = 'remove' then delete from public.tiktok_comments where id::text = p_id;
    else update public.tiktok_comments set hidden = (p_action = 'hide') where id::text = p_id; end if;
  elsif p_type = 'tiktok' then
    if p_action = 'keep' then delete from public.blocked_tiktoks where key = p_id;
    else insert into public.blocked_tiktoks (key, reason) values (p_id, 'moderator') on conflict do nothing; end if;
  elsif p_type = 'user' and p_action <> 'keep' then
    update public.posts set hidden = true where user_id::text = p_id;
  end if;

  update public.reports
    set status = case when p_action = 'keep' then 'dismissed' else 'actioned' end,
        resolved_at = now(), resolved_by = auth.uid()
    where target_type = p_type and target_id = p_id and status = 'open';
end;
$$;
grant execute on function public.moderate(text, text, text) to authenticated;

-- ── Per-account preferences: For You taste (follows you across phones) and family-safe mode ──
create table if not exists public.user_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  taste jsonb,
  family_safe boolean not null default false,
  family_pin_hash text,
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
drop policy if exists "Members read their own preferences" on public.user_preferences;
create policy "Members read their own preferences" on public.user_preferences for select using (auth.uid() = user_id);
drop policy if exists "Members create their own preferences" on public.user_preferences;
create policy "Members create their own preferences" on public.user_preferences for insert with check (auth.uid() = user_id);
drop policy if exists "Members update their own preferences" on public.user_preferences;
create policy "Members update their own preferences" on public.user_preferences for update using (auth.uid() = user_id);
