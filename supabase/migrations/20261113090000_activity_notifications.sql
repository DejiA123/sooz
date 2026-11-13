-- Likes, comments, replies and new followers become Activity (and phone notifications).
-- Owner-approved. Only adds: no existing rows are changed or removed.

-- When the phone notification for an activity went out (the push function claims each row once).
alter table public.notifications add column if not exists pushed_at timestamptz;
create index if not exists notifications_actor_recent_idx on public.notifications (actor_id, created_at desc);

-- One activity per person / kind / item a day: like → unlike → like doesn't notify twice.
create or replace function public.add_activity(target uuid, actor uuid, kind text, ref uuid, body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target is null or actor is null or target = actor then return; end if;
  -- nothing between people who blocked each other
  if exists (select 1 from user_blocks b where (b.blocker_id = target and b.blocked_id = actor) or (b.blocker_id = actor and b.blocked_id = target)) then return; end if;
  if kind <> 'comment' and kind <> 'reply' and exists (
    select 1 from notifications n
    where n.user_id = target and n.actor_id = actor and n.type = kind and n.reference_id is not distinct from ref
      and n.created_at > now() - interval '1 day'
  ) then return; end if;
  insert into notifications (user_id, actor_id, type, reference_id, content) values (target, actor, kind, ref, left(body, 200));
end $$;
revoke all on function public.add_activity(uuid, uuid, text, uuid, text) from public, anon, authenticated;

create or replace function public.handle_new_like_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform add_activity((select user_id from posts where id = new.post_id), new.user_id, 'like', new.post_id, 'Liked your post');
  return new;
end $$;

create or replace function public.handle_new_comment_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.hidden, false) then return new; end if;
  perform add_activity((select user_id from posts where id = new.post_id), new.user_id, 'comment', new.post_id, new.content);
  return new;
end $$;
drop trigger if exists on_new_comment on public.comments;
create trigger on_new_comment after insert on public.comments for each row execute function public.handle_new_comment_notification();

-- A reply to someone's comment under a Christian TikTok (reference = their comment).
create or replace function public.handle_new_tiktok_reply_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is null or coalesce(new.hidden, false) then return new; end if;
  perform add_activity((select user_id from tiktok_comments where id = new.parent_id), new.user_id, 'reply', new.parent_id, new.content);
  return new;
end $$;
drop trigger if exists on_new_tiktok_reply on public.tiktok_comments;
create trigger on_new_tiktok_reply after insert on public.tiktok_comments for each row execute function public.handle_new_tiktok_reply_notification();

create or replace function public.handle_new_follow_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform add_activity(new.following_id, new.follower_id, 'follow', new.follower_id, 'Started following you');
  return new;
end $$;
drop trigger if exists on_new_follow on public.follows;
create trigger on_new_follow after insert on public.follows for each row execute function public.handle_new_follow_notification();
