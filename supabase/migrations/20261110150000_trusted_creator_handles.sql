-- The daily library update (scripts/discover-christian-creators.mjs, no secrets) reads which TikTok
-- creators the admin trusted on the Christian TikTok page, so their newest videos join the library.
-- Only the public @usernames are returned.
create or replace function public.trusted_creator_handles()
returns table (handle text) language sql stable security definer set search_path = public as $$
  select lower(trim(leading '@' from t.handle)) from public.tiktok_trusted_creators t order by t.created_at;
$$;
grant execute on function public.trusted_creator_handles() to anon, authenticated;
