-- Live chalkboard broadcast: teacher draws, students watch in real time.
-- Strokes are polled (serverless-friendly), coordinates normalized 0-1.

create table if not exists chalkboard_sessions (
  id uuid primary key default gen_random_uuid(),
  classroom_id text not null,
  teacher_id text not null,
  teacher_name text not null default '',
  title text not null default 'Live lesson',
  is_live boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists chalkboard_sessions_live_idx
  on chalkboard_sessions (classroom_id, is_live) where is_live;

create table if not exists chalkboard_strokes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chalkboard_sessions(id) on delete cascade,
  seq integer not null,
  color text not null default '#ffffff',
  size integer not null default 6,
  eraser boolean not null default false,
  points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);
create index if not exists chalkboard_strokes_session_seq_idx
  on chalkboard_strokes (session_id, seq);
