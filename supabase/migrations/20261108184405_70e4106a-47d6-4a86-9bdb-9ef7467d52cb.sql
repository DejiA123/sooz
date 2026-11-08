alter table public.conversations add column if not exists created_by uuid default auth.uid();

create or replace function public.is_conversation_creator(target_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations where id = target_conversation_id and created_by = auth.uid());
$$;
revoke execute on function public.is_conversation_creator(uuid) from public, anon;
grant execute on function public.is_conversation_creator(uuid) to authenticated;

drop policy if exists "Public View Conversations" on public.conversations;
drop policy if exists "Auth Insert Conversations" on public.conversations;
create policy "Members and creators view conversations" on public.conversations
  for select to authenticated
  using (created_by = auth.uid() or public.is_chat_member(id));
create policy "Signed-in users create conversations" on public.conversations
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Public View Participants" on public.conversation_participants;
drop policy if exists "Auth Insert Participants" on public.conversation_participants;
create policy "Members view participants" on public.conversation_participants
  for select to authenticated
  using (public.is_chat_member(conversation_id) or public.is_conversation_creator(conversation_id));
create policy "Creators add participants" on public.conversation_participants
  for insert to authenticated
  with check (public.is_conversation_creator(conversation_id));