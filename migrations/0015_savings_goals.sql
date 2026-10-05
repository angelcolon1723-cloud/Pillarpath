-- Savings goals: parent + kid save toward something together.
-- Units move from the child's spendable balance into the goal's escrow
-- (saved_units). Releasing a goal returns escrow to the child.

create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  child_id integer not null,
  title text not null,
  emoji text not null default '🎯',
  target_units integer not null check (target_units > 0),
  saved_units integer not null default 0 check (saved_units >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'released')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists savings_goals_user_idx on savings_goals (user_id, status);
create index if not exists savings_goals_child_idx on savings_goals (child_id, status);
