-- Visitors (owner-approved): one row per visit (a phone opening SOOZ; a new visit after 30 min away).
-- Anonymous visitors are a random id per phone — no IP address or location is stored. Only admins
-- (moderators) can read them. Visits by admins themselves aren't recorded.

create table if not exists public.app_visits (
  id uuid primary key default gen_random_uuid(),
  device text not null,                 -- random id kept on the phone
  user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  first_page text,
  source text,                          -- Instagram, WhatsApp, Google, Direct…
  device_kind text,                     -- iPhone, Android, Computer…
  installed boolean not null default false, -- opened from the Home Screen app
  pages int not null default 1
);
create index if not exists app_visits_started_idx on public.app_visits (started_at desc);
create index if not exists app_visits_device_idx on public.app_visits (device, last_seen desc);

alter table public.app_visits enable row level security;
drop policy if exists "Moderators read visits" on public.app_visits;
create policy "Moderators read visits" on public.app_visits for select using (public.is_moderator());
-- No insert / update policies: visits are written only through track_visit() below.

-- Called when the app opens, comes back to the screen, every couple of minutes while open and on
-- page changes. Continues the phone's visit if it was active in the last 30 minutes, else starts one.
create or replace function public.track_visit(p_device text, p_page text, p_source text, p_device_kind text, p_installed boolean, p_new_page boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if p_device is null or length(p_device) < 8 or length(p_device) > 64 then return; end if;
  if public.is_moderator() then return; end if; -- admins' own visits don't count
  select id into v from app_visits where device = p_device and last_seen > now() - interval '30 minutes'
    order by last_seen desc limit 1;
  if v is not null then
    update app_visits set last_seen = now(), user_id = coalesce(auth.uid(), user_id),
      pages = pages + case when p_new_page then 1 else 0 end
    where id = v;
  else
    insert into app_visits (device, user_id, first_page, source, device_kind, installed)
    values (p_device, auth.uid(), left(p_page, 200), left(p_source, 40), left(p_device_kind, 20), coalesce(p_installed, false));
  end if;
end $$;
revoke all on function public.track_visit(text, text, text, text, boolean, boolean) from public;
grant execute on function public.track_visit(text, text, text, text, boolean, boolean) to anon, authenticated;

-- The admin Visitors page's numbers in one call (days and "today" in Irish time).
create or replace function public.visit_summary()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare tz text := 'Europe/Dublin'; today date := (now() at time zone tz)::date; out jsonb;
begin
  if not public.is_moderator() then raise exception 'not allowed'; end if;
  select jsonb_build_object(
    'now', (select count(distinct device) from app_visits where last_seen > now() - interval '5 minutes'),
    'today', (select jsonb_build_object('visits', count(*), 'visitors', count(distinct device)) from app_visits where (started_at at time zone tz)::date = today),
    'd7', (select jsonb_build_object('visits', count(*), 'visitors', count(distinct device)) from app_visits where started_at > now() - interval '7 days'),
    'd30', (select jsonb_build_object('visits', count(*), 'visitors', count(distinct device)) from app_visits where started_at > now() - interval '30 days'),
    'all', (select jsonb_build_object('visits', count(*), 'visitors', count(distinct device)) from app_visits),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'visits', coalesce(x.visits, 0), 'visitors', coalesce(x.visitors, 0)) order by d), '[]')
              from generate_series(today - 89, today, interval '1 day') g(d)
              left join (select (started_at at time zone tz)::date as vday, count(*) as visits, count(distinct device) as visitors
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
