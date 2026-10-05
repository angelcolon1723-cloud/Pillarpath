-- Teacher Library: Dropbox-style folders for teaching materials,
-- notes, and quick links to student work / progress. Phase 1 organizes
-- what's already in the app; real file uploads (R2) come next.

create table if not exists teacher_folders (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists teacher_folders_user_idx on teacher_folders (user_id);

create table if not exists teacher_library_items (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  folder_id uuid not null references teacher_folders (id) on delete cascade,
  kind text not null check (kind in ('material', 'note', 'link')),
  title text not null,
  ref_id text,
  body text,
  created_at timestamptz not null default now()
);
create index if not exists teacher_library_items_folder_idx on teacher_library_items (folder_id);
