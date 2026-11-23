-- Admin Insights (owner-approved): how people use SOOZ, for admins (moderators) only. Read-only.
-- Private messages stay private: only how many are sent — never what they say or who they're to.

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
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', g.d::date, 'active', coalesce(a.n, 0), 'actions', coalesce(x.n, 0)) order by g.d), '[]')
              from generate_series(today - (greatest(1, least(p_days, 180)) - 1), today, interval '1 day') g(d)
              left join (select (at_ at time zone tz)::date as vday, count(distinct user_id) n from active group by 1) a on a.vday = g.d::date
              left join (select (created_at at time zone tz)::date as vday, count(*) n from recent group by 1) x on x.vday = g.d::date),
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
