-- Teacher Library file uploads (Cloudflare R2).
-- Files live in R2; this table tracks them per folder.

create table if not exists teacher_library_files (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  folder_id uuid not null references teacher_folders (id) on delete cascade,
  file_key text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists teacher_library_files_folder_idx on teacher_library_files (folder_id);
create index if not exists teacher_library_files_user_idx on teacher_library_files (user_id);
