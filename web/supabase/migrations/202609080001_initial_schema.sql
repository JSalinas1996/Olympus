create extension if not exists pgcrypto;

create type public.subject_status as enum ('active', 'completed');
create type public.assignment_status as enum ('draft', 'ready', 'processing', 'blocked', 'completed');
create type public.document_kind as enum ('source', 'assignment', 'rubric', 'precedent_work', 'precedent_correction', 'generated');
create type public.run_status as enum ('queued', 'validating', 'drafting', 'evaluating', 'revising', 'blocked', 'completed', 'cancelled');

create table public.subjects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, code text, period text, status public.subject_status not null default 'active',
  student_prompt text not null default '', professor_prompt text not null default '', progress smallint not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade, title text not null,
  project_information text not null default '', problem_statement text not null default '', objective text not null default '', instructions text not null default '',
  student_prompt_override text, professor_prompt_override text, status public.assignment_status not null default 'draft', max_rounds smallint not null default 5 check (max_rounds between 1 and 20),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.rubric_items (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade, title text not null, description text not null default '', weight numeric(5,2), position integer not null default 0
);

create table public.documents (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade, assignment_id uuid references public.assignments(id) on delete cascade,
  kind public.document_kind not null, name text not null, mime_type text not null, size_bytes bigint not null check (size_bytes >= 0),
  drive_file_id text unique, drive_web_url text, page_count integer, processing_status text not null default 'pending', processing_error text,
  created_at timestamptz not null default now()
);

create table public.document_chunks (
  id bigint generated always as identity primary key, owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade, page_number integer, position integer not null,
  content text not null, search_vector tsvector generated always as (to_tsvector('spanish', content)) stored
);

create table public.precedents (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade, title text not null, academic_year integer,
  grade text, work_document_id uuid references public.documents(id) on delete set null, correction_document_id uuid references public.documents(id) on delete set null,
  user_notes text not null default '', created_at timestamptz not null default now()
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade, status public.run_status not null default 'queued',
  current_round smallint not null default 0, current_step text, estimated_cost_usd numeric(10,4), actual_cost_usd numeric(10,4), error_message text,
  idempotency_key text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.versions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade, run_id uuid references public.ai_runs(id) on delete set null,
  version_number integer not null, author text not null check (author in ('claude', 'user')), content jsonb not null,
  drive_file_id text, created_at timestamptz not null default now(), unique (assignment_id, version_number)
);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade, version_id uuid not null references public.versions(id) on delete cascade,
  estimated_score numeric(5,2), critical_errors jsonb not null default '[]', rubric_results jsonb not null default '[]', feedback text not null default '', created_at timestamptz not null default now()
);

create table public.user_feedback (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade, version_id uuid not null references public.versions(id) on delete cascade,
  content text not null, created_at timestamptz not null default now()
);

create table public.web_sources (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade, title text not null, publisher text, url text not null,
  accessed_at timestamptz not null default now(), excerpt text not null, verification_status text not null default 'pending'
);

create table public.oauth_connections (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_drive')), encrypted_tokens text not null,
  scopes text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (owner_id, provider)
);

create index subjects_owner_idx on public.subjects(owner_id);
create index assignments_owner_idx on public.assignments(owner_id);
create index assignments_subject_idx on public.assignments(subject_id);
create index documents_owner_idx on public.documents(owner_id);
create index documents_subject_idx on public.documents(subject_id);
create index document_chunks_owner_idx on public.document_chunks(owner_id);
create index document_chunks_search_idx on public.document_chunks using gin(search_vector);
create index ai_runs_owner_idx on public.ai_runs(owner_id);
create index versions_owner_idx on public.versions(owner_id);

do $$
declare table_name text;
begin
  foreach table_name in array array['subjects','assignments','rubric_items','documents','document_chunks','precedents','ai_runs','versions','evaluations','user_feedback','web_sources']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)', table_name || '_delete_own', table_name);
  end loop;
end $$;

alter table public.oauth_connections enable row level security;
revoke all on table public.oauth_connections from anon, authenticated;

grant usage, select on sequence public.document_chunks_id_seq to authenticated;
