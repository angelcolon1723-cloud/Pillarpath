-- Raise-hand queue: students raise hands, teacher calls on them in order.

create table if not exists hand_raises (
  id uuid primary key default gen_random_uuid(),
  classroom_id text not null,
  student_id text not null,
  student_name text not null default '',
  status text not null default 'raised' check (status in ('raised', 'called', 'lowered')),
  raised_at timestamptz not null default now(),
  called_at timestamptz
);
create index if not exists hand_raises_classroom_idx
  on hand_raises (classroom_id, status, raised_at) where status = 'raised';
create unique index if not exists hand_raises_one_raised_per_student
  on hand_raises (classroom_id, student_id) where status = 'raised';

-- Quick polls / exit tickets: teacher asks, students answer, live results.
create table if not exists quick_polls (
  id uuid primary key default gen_random_uuid(),
  classroom_id text not null,
  teacher_id text not null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists quick_polls_classroom_idx
  on quick_polls (classroom_id, is_open) where is_open;

create table if not exists poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references quick_polls(id) on delete cascade,
  student_id text not null,
  student_name text not null default '',
  option_index integer not null,
  created_at timestamptz not null default now(),
  unique (poll_id, student_id)
);
create index if not exists poll_responses_poll_idx on poll_responses (poll_id);
