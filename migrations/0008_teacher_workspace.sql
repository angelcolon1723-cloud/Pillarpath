-- 0008_teacher_workspace.sql
--
-- Server-backed teacher workspace: classrooms, rosters, lessons,
-- assignments + submissions (the gradebook), classroom Unit events
-- (strictly separate from family Units), family connection requests,
-- teacher<->parent threads, announcements/broadcasts, earning activity
-- templates, and the teacher verification queue.

create table if not exists classrooms (
  id uuid primary key,
  teacher_id text not null,
  name text not null,
  grade text not null default '',
  subject text not null default '',
  join_code text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists classrooms_teacher_idx on classrooms (teacher_id);

create table if not exists classroom_students (
  id uuid primary key,
  classroom_id uuid not null references classrooms (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists classroom_students_classroom_idx on classroom_students (classroom_id);

-- classroom_id null = broadcast to all of the teacher's rooms
create table if not exists classroom_announcements (
  id uuid primary key,
  teacher_id text not null,
  classroom_id uuid references classrooms (id) on delete cascade,
  audience_label text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists classroom_announcements_teacher_idx on classroom_announcements (teacher_id);

create table if not exists lessons (
  id uuid primary key,
  teacher_id text not null,
  classroom_id uuid references classrooms (id) on delete set null,
  title text not null,
  module text not null default '',
  description text not null default '',
  objective text not null default '',
  instructions text not null default '',
  materials text not null default '',
  questions text not null default '',
  completion_requirements text not null default '',
  unit_reward integer not null default 0,
  due_date text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists lessons_teacher_idx on lessons (teacher_id);

create table if not exists assignments (
  id uuid primary key,
  teacher_id text not null,
  classroom_id uuid not null references classrooms (id) on delete cascade,
  title text not null,
  description text not null default '',
  instructions text not null default '',
  materials text not null default '',
  rubric text not null default '',
  due_date text not null default '',
  unit_reward integer not null default 0,
  is_creative boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists assignments_teacher_idx on assignments (teacher_id);

-- Submissions double as the gradebook: a reviewed submission carries the
-- teacher's feedback and any Units awarded.
create table if not exists assignment_submissions (
  id uuid primary key,
  assignment_id uuid not null references assignments (id) on delete cascade,
  student_id uuid not null references classroom_students (id) on delete cascade,
  body text not null default '',
  status text not null default 'submitted',
  feedback text not null default '',
  units_awarded integer not null default 0,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists assignment_submissions_assignment_idx on assignment_submissions (assignment_id);

-- Classroom Units: append-only events; balances are derived (sum per
-- student). NEVER touches family ledger tables — classroom and family Units
-- are strictly separate by design.
create table if not exists classroom_unit_events (
  id uuid primary key,
  teacher_id text not null,
  classroom_id uuid not null references classrooms (id) on delete cascade,
  student_id uuid not null references classroom_students (id) on delete cascade,
  amount integer not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists classroom_unit_events_teacher_idx on classroom_unit_events (teacher_id);

create table if not exists classroom_connections (
  id uuid primary key,
  classroom_id uuid not null references classrooms (id) on delete cascade,
  child_name text not null,
  status text not null default 'pending',
  educational_permissions boolean not null default true,
  unit_permissions boolean not null default false,
  requested_at timestamptz not null default now()
);
create index if not exists classroom_connections_classroom_idx on classroom_connections (classroom_id);

create table if not exists family_threads (
  id uuid primary key,
  teacher_id text not null,
  classroom_id uuid not null references classrooms (id) on delete cascade,
  parent_name text not null,
  child_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists family_threads_teacher_idx on family_threads (teacher_id);

create table if not exists thread_messages (
  id uuid primary key,
  thread_id uuid not null references family_threads (id) on delete cascade,
  sender text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists thread_messages_thread_idx on thread_messages (thread_id);

create table if not exists classroom_activities (
  id uuid primary key,
  teacher_id text not null,
  name text not null,
  amount integer not null default 1,
  hint text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists classroom_activities_teacher_idx on classroom_activities (teacher_id);

create table if not exists teacher_verifications (
  teacher_id text primary key,
  school text not null default '',
  district text not null default '',
  work_email text not null default '',
  notes text not null default '',
  status text not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
