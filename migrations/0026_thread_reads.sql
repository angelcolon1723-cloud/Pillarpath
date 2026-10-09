-- Per-user read state for family message threads, powering the header
-- mail badge (unread count) in the parent and teacher dashboards.
-- A message is unread for a user when it was sent by the OTHER side of
-- the thread after the user's last_read_at for that thread.
create table if not exists thread_reads (
  thread_id uuid not null references family_threads (id) on delete cascade,
  user_id text not null,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
