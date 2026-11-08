-- Better profiles for people who join with Google or an emailed sign-in code.
--
-- Email/password sign-ups send a chosen username, which is used exactly as before (and still fails
-- if it is taken, so the sign-up form can say so). Google and email-code sign-ups send no username,
-- so we build a readable one from the email address (e.g. "grace.okafor@gmail.com" → "graceokafor",
-- or "graceokafor4821" if that is taken) and pick up the name and photo Google provides.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  chosen text := nullif(trim(meta ->> 'username'), '');
  base text;
  candidate text;
  attempts int := 0;
begin
  if chosen is not null then
    candidate := chosen;
  else
    base := regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g');
    if length(base) < 3 then
      base := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
    end if;
    base := left(base, 24);
    candidate := base;
    while exists (select 1 from public.profiles where username = candidate) loop
      attempts := attempts + 1;
      if attempts > 25 then
        candidate := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
        exit;
      end if;
      candidate := left(base, 20) || (1000 + floor(random() * 9000))::int::text;
    end loop;
  end if;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    coalesce(
      nullif(meta ->> 'display_name', ''),
      nullif(meta ->> 'full_name', ''),
      nullif(meta ->> 'name', ''),
      chosen,
      candidate
    ),
    coalesce(nullif(meta ->> 'avatar_url', ''), nullif(meta ->> 'picture', ''))
  );
  return new;
end;
$$;
