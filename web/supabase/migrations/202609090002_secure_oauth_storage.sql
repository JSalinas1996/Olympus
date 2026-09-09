create or replace function public.save_oauth_connection(
  p_encrypted_tokens text,
  p_scopes text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.oauth_connections (owner_id, provider, encrypted_tokens, scopes)
  values (current_user_id, 'google_drive', p_encrypted_tokens, coalesce(p_scopes, '{}'))
  on conflict (owner_id, provider)
  do update set
    encrypted_tokens = excluded.encrypted_tokens,
    scopes = excluded.scopes,
    updated_at = now();
end;
$$;

revoke all on function public.save_oauth_connection(text, text[]) from public, anon;
grant execute on function public.save_oauth_connection(text, text[]) to authenticated;
