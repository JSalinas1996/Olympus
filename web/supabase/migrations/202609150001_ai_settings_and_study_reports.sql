alter type public.document_kind add value if not exists 'study_report';

create table if not exists public.user_ai_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  development_prompt text not null default '',
  correction_prompt text not null default '',
  study_report_prompt text not null default '',
  claude_model text not null default '',
  claude_effort text not null default 'automatic',
  chatgpt_model text not null default '',
  chatgpt_effort text not null default 'automatic',
  logo_name text,
  logo_mime_type text,
  logo_size_bytes bigint check (logo_size_bytes is null or logo_size_bytes between 1 and 10485760),
  logo_drive_file_id text,
  logo_drive_web_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (claude_effort in ('automatic', 'low', 'medium', 'high', 'max')),
  check (chatgpt_effort in ('automatic', 'low', 'medium', 'high', 'xhigh', 'max'))
);

alter table public.user_ai_settings enable row level security;
revoke all on table public.user_ai_settings from anon, authenticated;
grant select, insert, update, delete on table public.user_ai_settings to authenticated;

create policy user_ai_settings_select_own on public.user_ai_settings
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy user_ai_settings_insert_own on public.user_ai_settings
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy user_ai_settings_update_own on public.user_ai_settings
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy user_ai_settings_delete_own on public.user_ai_settings
  for delete to authenticated using ((select auth.uid()) = owner_id);

alter table public.subjects
  add column if not exists study_report_prompt text not null default '',
  add column if not exists claude_model text not null default '',
  add column if not exists claude_effort text not null default '',
  add column if not exists chatgpt_model text not null default '',
  add column if not exists chatgpt_effort text not null default '';

alter table public.assignments
  add column if not exists study_report_prompt_override text,
  add column if not exists claude_model_override text,
  add column if not exists claude_effort_override text,
  add column if not exists chatgpt_model_override text,
  add column if not exists chatgpt_effort_override text;

alter table public.ai_runs
  add column if not exists run_type text not null default 'assignment_cycle',
  add column if not exists configuration_snapshot jsonb not null default '{}'::jsonb;

alter table public.ai_runs
  drop constraint if exists ai_runs_run_type_check;
alter table public.ai_runs
  add constraint ai_runs_run_type_check check (run_type in ('assignment_cycle', 'study_report'));
