grant select on public.tiktok_videos to anon;
grant select, update, delete on public.tiktok_videos to authenticated;
grant all on public.tiktok_videos to service_role;
grant select on public.tiktok_curators to authenticated;
grant all on public.tiktok_curators to service_role;
grant select, insert, update, delete on public.tiktok_trusted_creators to authenticated;
grant all on public.tiktok_trusted_creators to service_role;