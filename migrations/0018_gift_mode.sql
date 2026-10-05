-- Gift Mode: wishes linked to occasions, family contributes.
-- Contributions are pledges (no Units move) — family fulfills in real life.

create table if not exists gift_wishes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  child_id integer not null,
  title text not null,
  emoji text not null default '🎁',
  cost_units integer not null check (cost_units > 0),
  funded_units integer not null default 0 check (funded_units >= 0),
  occasion text,
  status text not null default 'open' check (status in ('open', 'gifted')),
  created_at timestamptz not null default now()
);
create index if not exists gift_wishes_user_idx on gift_wishes (user_id, status);

create table if not exists gift_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  wish_id uuid not null references gift_wishes (id) on delete cascade,
  contributor_name text not null,
  amount_units integer not null check (amount_units > 0),
  message text,
  created_at timestamptz not null default now()
);
create index if not exists gift_contributions_wish_idx on gift_contributions (wish_id);
