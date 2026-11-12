-- Security hardening (owner's request, Nov 2026: "it must not be hijacked").
-- Safe to run more than once.

-- 1. Old chat rules from hand-run SQL files (supabase/fix_chat_policies*.sql). Some let ANY signed-in
--    person add themselves to ANY chat (and so read its messages), or skip the disappearing-message
--    and blocking checks. Rules are added together, so one leftover open rule opens the whole table.
--    The current rules (migrations 20261108184405 and 20261109150000) stay.
drop policy if exists "Safe Insert Participants" on public.conversation_participants;
drop policy if exists "Safe View Participants"   on public.conversation_participants;
drop policy if exists "Auth Insert Participants" on public.conversation_participants;
drop policy if exists "Public View Participants" on public.conversation_participants;
drop policy if exists "Public View Conversations" on public.conversations;
drop policy if exists "Auth Insert Conversations" on public.conversations;
drop policy if exists "Safe Insert Messages"   on public.messages;
drop policy if exists "Safe View Messages"     on public.messages;
drop policy if exists "Member Insert Messages" on public.messages;
drop policy if exists "Member View Messages"   on public.messages;

-- Any other leftover rule on the chat tables that lets everyone in ("true", or just "signed in").
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('conversations', 'conversation_participants', 'messages')
      and permissive = 'PERMISSIVE'
      and (
        coalesce(qual, '') in ('true', '(auth.role() = ''authenticated''::text)')
        or coalesce(with_check, '') in ('true', '(auth.role() = ''authenticated''::text)')
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    raise notice 'Dropped open policy % on %', r.policyname, r.tablename;
  end loop;
end $$;

-- 2. Anyone could look up any member's email address from their username (supabase/get_email_by_username.sql).
--    The app doesn't use it.
drop function if exists public.get_email_by_username(text);

-- 3. Moderation can't be undone by the author: only moderators (or the reporting / moderate()
--    functions, which run as the database owner) can change `hidden`. The trigger runs as the caller
--    (not security definer), so current_user tells a member's own request ('authenticated') apart
--    from those functions ('postgres').
create or replace function public.guard_hidden_flag()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.hidden is distinct from old.hidden
     and auth.uid() is not null
     and current_user in ('authenticated', 'anon')
     and not public.is_moderator() then
    new.hidden := old.hidden;
  end if;
  return new;
end $$;

drop trigger if exists posts_guard_hidden on public.posts;
create trigger posts_guard_hidden before update on public.posts
  for each row execute function public.guard_hidden_flag();
drop trigger if exists comments_guard_hidden on public.comments;
create trigger comments_guard_hidden before update on public.comments
  for each row execute function public.guard_hidden_flag();
drop trigger if exists tiktok_comments_guard_hidden on public.tiktok_comments;
create trigger tiktok_comments_guard_hidden before update on public.tiktok_comments
  for each row execute function public.guard_hidden_flag();

-- 4. Live: any signed-in person could rewrite ANY live stream (and so broadcast their own clips
--    on someone else's live). Now each live belongs to the person streaming it (stream_uid = their
--    account id, which the app already sets); moderators can still end any live.
drop policy if exists "Enable insert for authenticated users" on public.live_stream_config;
drop policy if exists "Enable update for authenticated users" on public.live_stream_config;
drop policy if exists "Streamers start their own live" on public.live_stream_config;
drop policy if exists "Streamers update their own live" on public.live_stream_config;
create policy "Streamers start their own live" on public.live_stream_config
  for insert to authenticated with check (stream_uid = auth.uid()::text);
create policy "Streamers update their own live" on public.live_stream_config
  for update to authenticated
  using (stream_uid = auth.uid()::text or public.is_moderator())
  with check (stream_uid = auth.uid()::text or public.is_moderator());