-- Units transaction log: every Units movement, server-side.
-- Powers Spending Insights for parents. Kinds: earn, spend, save,
-- vault, give, goal (savings-goal escrow), release, load, award, adjust.

create table if not exists units_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  child_id integer,
  kind text not null check (kind in (
    'earn', 'spend', 'save', 'vault', 'give', 'goal',
    'release', 'load', 'award', 'adjust'
  )),
  amount integer not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists units_transactions_user_idx on units_transactions (user_id, created_at desc);
create index if not exists units_transactions_child_idx on units_transactions (child_id, created_at desc);
