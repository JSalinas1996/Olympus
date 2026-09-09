alter table public.subjects add column if not exists drive_folder_id text;
alter table public.assignments add column if not exists drive_folder_id text;

create or replace function public.get_my_google_drive_tokens()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select encrypted_tokens
  from public.oauth_connections
  where owner_id = auth.uid() and provider = 'google_drive'
  limit 1;
$$;

revoke all on function public.get_my_google_drive_tokens() from public, anon;
grant execute on function public.get_my_google_drive_tokens() to authenticated;
