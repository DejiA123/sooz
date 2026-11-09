-- WhatsApp-style messaging for SOOZ. Adds only: nothing is removed and every chat / message is kept.
--  * messages: reply, forwarded, edited, attachments (photo, video, voice note, document, location,
--    contact, poll), disappearing (expires_at)
--  * reactions, starred, "delete for me", pinned messages, poll votes, blocked people
--  * each person's settings per chat: read / delivered ticks, archive, pin, mute, mark unread,
--    favourite, clear chat, delete chat; group admins
--  * groups: description, photo, disappearing timer, "only admins can send / edit info"

-- ── Messages ───────────────────────────────────────────────────────────────────────────────────
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists forwarded boolean not null default false,
  add column if not exists edited_at timestamptz,
  add column if not exists attachment jsonb,
  add column if not exists expires_at timestamptz;
create index if not exists messages_conversation_time_idx on public.messages (conversation_id, created_at desc);

-- ── Chats ──────────────────────────────────────────────────────────────────────────────────────
alter table public.conversations
  add column if not exists description text,
  add column if not exists avatar_url text,
  add column if not exists disappear_seconds integer check (disappear_seconds is null or disappear_seconds > 0),
  add column if not exists only_admins_send boolean not null default false,
  add column if not exists only_admins_edit boolean not null default false;

-- ── Each person in each chat ───────────────────────────────────────────────────────────────────
alter table public.conversation_participants
  add column if not exists role text not null default 'member' check (role in ('member', 'admin')),
  add column if not exists last_read_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists archived boolean not null default false,
  add column if not exists pinned_at timestamptz,
  add column if not exists muted_until timestamptz,
  add column if not exists marked_unread boolean not null default false,
  add column if not exists favourite boolean not null default false,
  add column if not exists cleared_at timestamptz,
  add column if not exists hidden_at timestamptz;

-- Group creators become admins; everything sent so far counts as delivered and read.
update public.conversation_participants cp set role = 'admin'
  from public.conversations c
  where c.id = cp.conversation_id and c.type = 'group' and c.created_by = cp.user_id and cp.role <> 'admin';
update public.conversation_participants
  set last_read_at = coalesce(last_read_at, now()), delivered_at = coalesce(delivered_at, now());

-- ── Helpers ────────────────────────────────────────────────────────────────────────────────────
create or replace function public.is_chat_admin(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = target_conversation_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- In a direct chat, has either person blocked the other?
create table if not exists public.user_blocks (
  blocker_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists "See your own blocks" on public.user_blocks;
create policy "See your own blocks" on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "Block people" on public.user_blocks;
create policy "Block people" on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists "Unblock people" on public.user_blocks;
create policy "Unblock people" on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());

create or replace function public.chat_blocked(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from conversations c
    join conversation_participants o on o.conversation_id = c.id and o.user_id <> auth.uid()
    join user_blocks b on (b.blocker_id = o.user_id and b.blocked_id = auth.uid())
                       or (b.blocker_id = auth.uid() and b.blocked_id = o.user_id)
    where c.id = target_conversation_id and c.type = 'direct'
  );
$$;

create or replace function public.can_send_in(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_chat_member(target_conversation_id)
     and not public.chat_blocked(target_conversation_id)
     and (not coalesce((select only_admins_send from conversations where id = target_conversation_id), false)
          or public.is_chat_admin(target_conversation_id));
$$;

-- ── Message rules ──────────────────────────────────────────────────────────────────────────────
drop policy if exists "Member View Messages" on public.messages;
create policy "Member View Messages" on public.messages for select
  using (public.is_chat_member(conversation_id) and (expires_at is null or expires_at > now()));

drop policy if exists "Member Insert Messages" on public.messages;
create policy "Member Insert Messages" on public.messages for insert
  with check (sender_id = auth.uid() and public.can_send_in(conversation_id));

-- Disappearing messages: each new message gets the chat's timer.
create or replace function public.set_message_expiry()
returns trigger language plpgsql security definer set search_path = public as $$
declare secs integer;
begin
  select disappear_seconds into secs from conversations where id = new.conversation_id;
  if secs is not null then new.expires_at := now() + make_interval(secs => secs); end if;
  return new;
end $$;
drop trigger if exists messages_set_expiry on public.messages;
create trigger messages_set_expiry before insert on public.messages for each row execute function public.set_message_expiry();

-- Senders may edit or delete their own messages, but never move them or change who / when.
create or replace function public.guard_message_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.conversation_id <> old.conversation_id or new.sender_id <> old.sender_id or new.created_at <> old.created_at
     or new.expires_at is distinct from old.expires_at or new.forwarded <> old.forwarded then
    raise exception 'That can''t be changed';
  end if;
  return new;
end $$;
drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update before update on public.messages for each row execute function public.guard_message_update();

-- Group admins can delete anyone's message in their group ("deleted by admin").
create or replace function public.admin_delete_message(target_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare conv uuid;
begin
  select conversation_id into conv from messages where id = target_message_id;
  if conv is null or not public.is_chat_admin(conv) then raise exception 'Only group admins can do that'; end if;
  update messages set is_deleted = true, content = '', attachment = null where id = target_message_id;
end $$;

-- ── Chat settings rules ────────────────────────────────────────────────────────────────────────
drop policy if exists "Members update chat info" on public.conversations;
create policy "Members update chat info" on public.conversations for update to authenticated
  using (public.is_chat_member(id) and (type = 'direct' or not only_admins_edit or public.is_chat_admin(id)))
  with check (public.is_chat_member(id));

create or replace function public.guard_conversation_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- server jobs
  if new.id <> old.id or new.type <> old.type or new.created_by is distinct from old.created_by then
    raise exception 'That can''t be changed';
  end if;
  if (new.only_admins_send is distinct from old.only_admins_send or new.only_admins_edit is distinct from old.only_admins_edit)
     and not public.is_chat_admin(old.id) then
    raise exception 'Only group admins can change this';
  end if;
  return new;
end $$;
drop trigger if exists conversations_guard_update on public.conversations;
create trigger conversations_guard_update before update on public.conversations for each row execute function public.guard_conversation_update();

-- People: update your own settings; admins (and the creator) add people; leave, or admins remove.
drop policy if exists "Members update their own chat settings" on public.conversation_participants;
create policy "Members update their own chat settings" on public.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Creators add participants" on public.conversation_participants;
create policy "Creators add participants" on public.conversation_participants for insert
  with check (public.is_conversation_creator(conversation_id) or public.is_chat_admin(conversation_id));

drop policy if exists "Leave or remove members" on public.conversation_participants;
create policy "Leave or remove members" on public.conversation_participants for delete to authenticated
  using (user_id = auth.uid() or public.is_chat_admin(conversation_id));

create or replace function public.guard_participant_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or auth.uid() is null then return new; end if;
  if new.conversation_id <> old.conversation_id or new.user_id <> old.user_id then raise exception 'That can''t be changed'; end if;
  if new.role is distinct from old.role and not public.is_chat_admin(old.conversation_id) then
    raise exception 'Only group admins can change roles';
  end if;
  return new;
end $$;
drop trigger if exists participants_guard_update on public.conversation_participants;
create trigger participants_guard_update before update on public.conversation_participants for each row execute function public.guard_participant_update();

-- The group's creator joins as its admin.
create or replace function public.creator_joins_as_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from conversations where id = new.conversation_id and type = 'group' and created_by = new.user_id) then
    new.role := 'admin';
  end if;
  return new;
end $$;
drop trigger if exists participants_creator_admin on public.conversation_participants;
create trigger participants_creator_admin before insert on public.conversation_participants for each row execute function public.creator_joins_as_admin();

-- A group always keeps an admin: if the last one leaves, the longest-standing member becomes admin.
create or replace function public.keep_a_group_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from conversations where id = old.conversation_id and type = 'group')
     and not exists (select 1 from conversation_participants where conversation_id = old.conversation_id and role = 'admin') then
    update conversation_participants set role = 'admin'
    where conversation_id = old.conversation_id
      and user_id = (select user_id from conversation_participants where conversation_id = old.conversation_id order by joined_at limit 1);
  end if;
  return null;
end $$;
drop trigger if exists participants_keep_admin on public.conversation_participants;
create trigger participants_keep_admin after delete on public.conversation_participants for each row execute function public.keep_a_group_admin();

create or replace function public.set_chat_role(target_conversation_id uuid, member_id uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if new_role not in ('member', 'admin') then raise exception 'Unknown role'; end if;
  if not public.is_chat_admin(target_conversation_id) then raise exception 'Only group admins can do that'; end if;
  update conversation_participants set role = new_role where conversation_id = target_conversation_id and user_id = member_id;
end $$;

-- Open (or start) the one-to-one chat with someone.
create or replace function public.get_or_create_direct_chat(other_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); conv uuid;
begin
  if me is null or other_user is null or other_user = me then raise exception 'Can''t start that chat'; end if;
  if not exists (select 1 from profiles where id = other_user) then raise exception 'No such member'; end if;
  select c.id into conv
  from conversations c
  join conversation_participants a on a.conversation_id = c.id and a.user_id = me
  join conversation_participants b on b.conversation_id = c.id and b.user_id = other_user
  where c.type = 'direct'
  order by c.created_at
  limit 1;
  if conv is null then
    insert into conversations (type, created_by) values ('direct', me) returning id into conv;
    insert into conversation_participants (conversation_id, user_id, last_read_at, delivered_at)
      values (conv, me, now(), now()), (conv, other_user, null, null);
  else
    update conversation_participants set hidden_at = null where conversation_id = conv and user_id = me;
  end if;
  return conv;
end $$;

-- Mark everything sent to me so far as delivered (only chats with something new, to keep it quiet).
create or replace function public.mark_chats_delivered()
returns void language sql security definer set search_path = public as $$
  update conversation_participants cp set delivered_at = now()
  where cp.user_id = auth.uid()
    and exists (
      select 1 from messages m
      where m.conversation_id = cp.conversation_id and m.sender_id <> auth.uid()
        and m.created_at > coalesce(cp.delivered_at, '-infinity'::timestamptz)
    );
$$;

-- ── Reactions, starred, delete for me, pinned, poll votes ──────────────────────────────────────
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists message_reactions_conversation_idx on public.message_reactions (conversation_id);

create table if not exists public.message_stars (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create table if not exists public.message_hidden (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

create table if not exists public.message_pins (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (conversation_id, message_id)
);

create table if not exists public.poll_votes (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  options smallint[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- The message really belongs to that chat (so rows can't point across chats).
create or replace function public.message_in_chat(target_message_id uuid, target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from messages where id = target_message_id and conversation_id = target_conversation_id);
$$;

alter table public.message_reactions enable row level security;
alter table public.message_stars enable row level security;
alter table public.message_hidden enable row level security;
alter table public.message_pins enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "Members see reactions" on public.message_reactions;
create policy "Members see reactions" on public.message_reactions for select using (public.is_chat_member(conversation_id));
drop policy if exists "Members react" on public.message_reactions;
create policy "Members react" on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_chat_member(conversation_id) and public.message_in_chat(message_id, conversation_id));
drop policy if exists "Members change their reaction" on public.message_reactions;
create policy "Members change their reaction" on public.message_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.message_in_chat(message_id, conversation_id));
drop policy if exists "Members remove their reaction" on public.message_reactions;
create policy "Members remove their reaction" on public.message_reactions for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Own starred messages" on public.message_stars;
create policy "Own starred messages" on public.message_stars for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_chat_member(conversation_id) and public.message_in_chat(message_id, conversation_id));

drop policy if exists "Own hidden messages" on public.message_hidden;
create policy "Own hidden messages" on public.message_hidden for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_chat_member(conversation_id) and public.message_in_chat(message_id, conversation_id));

drop policy if exists "Members see pins" on public.message_pins;
create policy "Members see pins" on public.message_pins for select using (public.is_chat_member(conversation_id));
drop policy if exists "Members pin" on public.message_pins;
create policy "Members pin" on public.message_pins for insert to authenticated
  with check (pinned_by = auth.uid() and public.can_send_in(conversation_id) and public.message_in_chat(message_id, conversation_id));
drop policy if exists "Members unpin" on public.message_pins;
create policy "Members unpin" on public.message_pins for delete to authenticated using (public.is_chat_member(conversation_id));

drop policy if exists "Members see votes" on public.poll_votes;
create policy "Members see votes" on public.poll_votes for select using (public.is_chat_member(conversation_id));
drop policy if exists "Members vote" on public.poll_votes;
create policy "Members vote" on public.poll_votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_chat_member(conversation_id) and public.message_in_chat(message_id, conversation_id));
drop policy if exists "Members change their vote" on public.poll_votes;
create policy "Members change their vote" on public.poll_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.message_in_chat(message_id, conversation_id));
drop policy if exists "Members take back their vote" on public.poll_votes;
create policy "Members take back their vote" on public.poll_votes for delete to authenticated using (user_id = auth.uid());

-- ── The chat list in one call ──────────────────────────────────────────────────────────────────
drop function if exists public.my_chat_list();
create function public.my_chat_list()
returns table (
  id uuid, type text, name text, avatar_url text, created_at timestamptz, disappear_seconds integer,
  archived boolean, pinned_at timestamptz, muted_until timestamptz, marked_unread boolean, favourite boolean,
  hidden_at timestamptz, cleared_at timestamptz, last_read_at timestamptz,
  other_user_id uuid, other_username text, other_display_name text, other_avatar_url text, other_updated_at timestamptz,
  last_message_id uuid, last_content text, last_sender_id uuid, last_sender_name text, last_created_at timestamptz,
  last_is_deleted boolean, last_attachment jsonb, unread bigint, member_count bigint,
  others_read_at timestamptz, others_delivered_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.type::text, c.name, c.avatar_url, c.created_at, c.disappear_seconds,
    me.archived, me.pinned_at, me.muted_until, me.marked_unread, me.favourite, me.hidden_at, me.cleared_at, me.last_read_at,
    o.user_id, op.username, op.display_name, op.avatar_url, op.updated_at,
    lm.id, lm.content, lm.sender_id, coalesce(sp.display_name, sp.username), lm.created_at, coalesce(lm.is_deleted, false), lm.attachment,
    (select count(*) from messages m
      where m.conversation_id = c.id and m.sender_id <> auth.uid() and not coalesce(m.is_deleted, false)
        and m.created_at > greatest(coalesce(me.last_read_at, '-infinity'::timestamptz), coalesce(me.cleared_at, '-infinity'::timestamptz), me.joined_at - interval '1 second')
        and (m.expires_at is null or m.expires_at > now())
        and not exists (select 1 from message_hidden h where h.message_id = m.id and h.user_id = auth.uid())),
    (select count(*) from conversation_participants x where x.conversation_id = c.id),
    -- For my ticks: when everyone else last read / received.
    (select min(coalesce(x.last_read_at, '-infinity'::timestamptz)) from conversation_participants x where x.conversation_id = c.id and x.user_id <> auth.uid()),
    (select min(greatest(coalesce(x.delivered_at, '-infinity'::timestamptz), coalesce(x.last_read_at, '-infinity'::timestamptz))) from conversation_participants x where x.conversation_id = c.id and x.user_id <> auth.uid())
  from conversation_participants me
  join conversations c on c.id = me.conversation_id
  left join lateral (
    select x.user_id from conversation_participants x
    where c.type = 'direct' and x.conversation_id = c.id and x.user_id <> auth.uid()
    order by x.joined_at limit 1
  ) o on true
  left join profiles op on op.id = o.user_id
  left join lateral (
    select m.* from messages m
    where m.conversation_id = c.id
      and m.created_at > coalesce(me.cleared_at, '-infinity'::timestamptz)
      and (m.expires_at is null or m.expires_at > now())
      and not exists (select 1 from message_hidden h where h.message_id = m.id and h.user_id = auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  left join profiles sp on sp.id = lm.sender_id
  where me.user_id = auth.uid();
$$;

revoke execute on function public.my_chat_list() from anon;
revoke execute on function public.get_or_create_direct_chat(uuid) from anon;
revoke execute on function public.mark_chats_delivered() from anon;
revoke execute on function public.set_chat_role(uuid, uuid, text) from anon;
revoke execute on function public.admin_delete_message(uuid) from anon;
grant execute on function public.my_chat_list() to authenticated;
grant execute on function public.get_or_create_direct_chat(uuid) to authenticated;
grant execute on function public.mark_chats_delivered() to authenticated;
grant execute on function public.set_chat_role(uuid, uuid, text) to authenticated;
grant execute on function public.admin_delete_message(uuid) to authenticated;

-- ── Live updates ───────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['message_reactions', 'message_pins', 'poll_votes'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Older groups didn't record their creator. The app adds the creator first, so the first member row
-- stored is the creator: they become the group's admin (and recorded creator).
with first_member as (
  select distinct on (cp.conversation_id) cp.conversation_id, cp.user_id
  from public.conversation_participants cp
  join public.conversations c on c.id = cp.conversation_id
  where c.type = 'group'
    and not exists (select 1 from public.conversation_participants a where a.conversation_id = cp.conversation_id and a.role = 'admin')
  order by cp.conversation_id, cp.joined_at, cp.ctid
)
update public.conversation_participants cp set role = 'admin'
from first_member f where cp.conversation_id = f.conversation_id and cp.user_id = f.user_id;

update public.conversations c set created_by = cp.user_id
from public.conversation_participants cp
where c.type = 'group' and c.created_by is null and cp.conversation_id = c.id and cp.role = 'admin';
