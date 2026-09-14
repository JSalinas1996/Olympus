alter table public.assignments
  add column if not exists manual_notes text not null default '';

alter table public.documents
  add column if not exists teacher_feedback text not null default '';
