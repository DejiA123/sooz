-- App feedback (owner's request): a thumbs up / down with an optional comment, from signed-in
-- people. Only moderators (the owner) can read it; nobody can change or delete someone else's.
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating text not null check (rating in ('up', 'down')),
  comment text check (char_length(comment) <= 2000),
  page text check (char_length(page) <= 200),
  app_version text check (char_length(app_version) <= 60),
  device text check (char_length(device) <= 300),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists app_feedback_created_idx on public.app_feedback (created_at desc);

alter table public.app_feedback enable row level security;

drop policy if exists "Send feedback" on public.app_feedback;
create policy "Send feedback" on public.app_feedback for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Moderators read feedback" on public.app_feedback;
create policy "Moderators read feedback" on public.app_feedback for select to authenticated
  using (public.is_moderator());

drop policy if exists "Moderators update feedback" on public.app_feedback;
create policy "Moderators update feedback" on public.app_feedback for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

drop policy if exists "Moderators delete feedback" on public.app_feedback;
create policy "Moderators delete feedback" on public.app_feedback for delete to authenticated
  using (public.is_moderator());

grant select, insert, update, delete on public.app_feedback to authenticated;
