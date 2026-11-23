-- Scrolls and time on screen (owner-approved): each visit also counts how many videos were scrolled
-- through and how many seconds SOOZ was on screen. Numbers only — never which videos. Read only by
-- admins (moderators), like the rest of app_visits.

alter table public.app_visits add column if not exists videos int not null default 0;
alter table public.app_visits add column if not exists seconds int not null default 0;

-- Same as before plus the videos / seconds since the phone's last call (capped, so a broken or
-- tampered phone can't inflate them). Old copies of the app still call it with the first six.
drop function if exists public.track_visit(text, text, text, text, boolean, boolean);
create or replace function public.track_visit(p_device text, p_page text, p_source text, p_device_kind text, p_installed boolean,
  p_new_page boolean default false, p_videos int default 0, p_seconds int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid;
  nv int := greatest(0, least(coalesce(p_videos, 0), 300));
  ns int := greatest(0, least(coalesce(p_seconds, 0), 1800));
begin
  if p_device is null or length(p_device) < 8 or length(p_device) > 64 then return; end if;
  if public.is_moderator() then return; end if; -- admins' own visits don't count
  select id into v from app_visits where device = p_device and last_seen > now() - interval '30 minutes'
    order by last_seen desc limit 1;
  if v is not null then
    update app_visits set last_seen = now(), user_id = coalesce(auth.uid(), user_id),
      pages = pages + case when p_new_page then 1 else 0 end,
      videos = videos + nv, seconds = seconds + ns
    where id = v;
  else
    insert into app_visits (device, user_id, first_page, source, device_kind, installed, videos, seconds)
    values (p_device, auth.uid(), left(p_page, 200), left(p_source, 40), left(p_device_kind, 20), coalesce(p_installed, false), nv, ns);
  end if;
end $$;
revoke all on function public.track_visit(text, text, text, text, boolean, boolean, int, int) from public;
grant execute on function public.track_visit(text, text, text, text, boolean, boolean, int, int) to anon, authenticated;

-- Visitors page: the period counts now include videos scrolled and seconds on screen.
create or replace function public.visit_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare tz text := 'Europe/Dublin'; today date := (now() at time zone tz)::date; out jsonb;
begin
  if not public.is_moderator() then raise exception 'not allowed'; end if;
  select jsonb_build_object(
    'now', (select count(distinct device) from app_visits where last_seen > now() - interval '5 minutes'),
    'today', (select jsonb_build_object('visits', count(*), 'visitors', count(distinct device), 'videos', coalesce(sum(videos), 0), 'seconds', coalesce(sum(seconds), 0)) from app_visits where (started_at at time zone tz)::date = today),
    'd7', (select jsonb_build_object('visits', count(*), 'visitors', count(distinct device), 'videos', coalesce(sum(videos), 0), 'seconds', coalesce(sum(seconds), 0)) from app_visits where started_at > now() - interval '7 days'),
    'd30', (select jsonb_build_object('visits', count(*), 'visitors', count(distinct device), 'videos', coalesce(sum(videos), 0), 'seconds', coalesce(sum(seconds), 0)) from app_visits where started_at > now() - interval '30 days'),
    'all', (select jsonb_build_object('visits', count(*), 'visitors', count(distinct device), 'videos', coalesce(sum(videos), 0), 'seconds', coalesce(sum(seconds), 0)) from app_visits),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'visits', coalesce(x.visits, 0), 'visitors', coalesce(x.visitors, 0), 'videos', coalesce(x.videos, 0)) order by d), '[]')
              from generate_series(today - 89, today, interval '1 day') g(d)
              left join (select (started_at at time zone tz)::date as vday, count(*) as visits, count(distinct device) as visitors, sum(videos) as videos
                         from app_visits where started_at > now() - interval '91 days' group by 1) x on x.vday = g.d::date),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('name', s, 'n', n) order by n desc), '[]') from
                (select coalesce(source, 'Direct') s, count(*) n from app_visits where started_at > now() - interval '30 days' group by 1) t),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('name', s, 'n', n) order by n desc), '[]') from
                (select coalesce(device_kind, 'Other') || case when installed then ' · app' else ' · browser' end s, count(*) n
                 from app_visits where started_at > now() - interval '30 days' group by 1) t),
    'members', (select count(distinct user_id) from app_visits where started_at > now() - interval '30 days' and user_id is not null)
  ) into out;
  return out;
end $$;
revoke all on function public.visit_summary() from public;
grant execute on function public.visit_summary() to authenticated;
revoke execute on function public.visit_summary() from anon;

-- Insights: adds 'watch' (videos scrolled, time on screen, visits, visitors — signed out too),
-- videos per day, and the members who watch the most.
create or replace function public.admin_insights(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tz text := 'Europe/Dublin';
  today date := (now() at time zone tz)::date;
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 180)));
  out jsonb;
begin
  if not public.is_moderator() then raise exception 'not allowed'; end if;

  with acts as (
    select user_id, created_at, 'post'::text kind from posts
    union all select user_id, created_at, 'story' from stories
    union all select user_id, created_at, 'like' from likes
    union all select user_id, created_at, 'comment' from comments
    union all select user_id, created_at, 'comment' from tiktok_comments
    union all select follower_id, created_at, 'follow' from follows
    union all select user_id, created_at, 'repost' from reposts
    union all select user_id, created_at, 'share' from post_shares
    union all select user_id, created_at, 'save' from bookmarks
    union all select sender_id, created_at, 'message' from messages
  ),
  recent as (select * from acts where created_at > since and user_id is not null),
  visits as (select * from app_visits where started_at > since),
  -- "Active" = did something, or opened SOOZ signed in (Visitors).
  active as (
    select user_id, created_at at_ from recent
    union all select user_id, last_seen from app_visits where user_id is not null and last_seen > since
  )
  select jsonb_build_object(
    'days', greatest(1, least(p_days, 180)),
    'members', (select count(*) from profiles),
    'active', jsonb_build_object(
      'today', (select count(distinct user_id) from active where (at_ at time zone tz)::date = today),
      'd7', (select count(distinct user_id) from active where at_ > now() - interval '7 days'),
      'd30', (select count(distinct user_id) from active where at_ > now() - interval '30 days')
    ),
    'totals', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from recent group by kind) t),
    'watch', (select jsonb_build_object('videos', coalesce(sum(videos), 0), 'seconds', coalesce(sum(seconds), 0),
                'visits', count(*), 'visitors', count(distinct device),
                'counted', count(*) filter (where videos > 0 or seconds > 0)) from visits),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', g.d::date, 'active', coalesce(a.n, 0), 'actions', coalesce(x.n, 0), 'videos', coalesce(w.n, 0)) order by g.d), '[]')
              from generate_series(today - (greatest(1, least(p_days, 180)) - 1), today, interval '1 day') g(d)
              left join (select (at_ at time zone tz)::date as vday, count(distinct user_id) n from active group by 1) a on a.vday = g.d::date
              left join (select (created_at at time zone tz)::date as vday, count(*) n from recent group by 1) x on x.vday = g.d::date
              left join (select (started_at at time zone tz)::date as vday, sum(videos) n from visits group by 1) w on w.vday = g.d::date),
    'top_members', (select coalesce(jsonb_agg(row_to_json(t) order by t.total desc), '[]') from (
        select r.user_id id, p.username, coalesce(nullif(trim(p.display_name), ''), p.username) as name, p.avatar_url avatar,
               count(*) total,
               count(*) filter (where kind in ('post', 'story')) posts,
               count(*) filter (where kind = 'like') likes,
               count(*) filter (where kind = 'comment') comments,
               count(*) filter (where kind = 'follow') follows,
               count(*) filter (where kind in ('repost', 'share', 'save')) shares,
               count(*) filter (where kind = 'message') messages,
               max(r.created_at) last_at
        from recent r join profiles p on p.id = r.user_id
        group by r.user_id, p.username, p.display_name, p.avatar_url
        order by count(*) desc limit 15) t),
    'top_watchers', (select coalesce(jsonb_agg(row_to_json(t) order by t.seconds desc), '[]') from (
        select v.user_id id, p.username, coalesce(nullif(trim(p.display_name), ''), p.username) as name, p.avatar_url avatar,
               sum(v.videos) videos, sum(v.seconds) seconds, count(*) visits, max(v.last_seen) last_at
        from visits v join profiles p on p.id = v.user_id
        group by v.user_id, p.username, p.display_name, p.avatar_url
        having sum(v.videos) > 0 or sum(v.seconds) > 0
        order by sum(v.seconds) desc limit 10) t),
    'top_posts', (select coalesce(jsonb_agg(row_to_json(t) order by t.score desc), '[]') from (
        select po.id, po.caption, po.media_type, coalesce(po.thumbnail_url, case when po.media_type = 'image' then po.media_url end) image,
               pr.username, coalesce(nullif(trim(pr.display_name), ''), pr.username) as name,
               (select count(*) from likes l where l.post_id = po.id) likes,
               (select count(*) from comments c where c.post_id = po.id) comments,
               (select count(*) from likes l where l.post_id = po.id) + 2 * (select count(*) from comments c where c.post_id = po.id) score
        from posts po join profiles pr on pr.id = po.user_id
        where po.created_at > since and not coalesce(po.hidden, false)
        order by score desc, po.created_at desc limit 10) t),
    'new_members', (select count(*) from profiles where created_at > since)
  ) into out;
  return out;
end $$;
revoke all on function public.admin_insights(int) from public, anon;
grant execute on function public.admin_insights(int) to authenticated;
