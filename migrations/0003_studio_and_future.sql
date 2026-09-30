-- Creative Studio projects, learning progress, and closed-loop Future Units.

alter table profiles add column if not exists studio_plus boolean not null default false;

alter table children add column if not exists future_reserved_units integer not null default 0;

create table if not exists future_unit_plans (
  id text primary key,
  user_id text not null references "user"("id") on delete cascade,
  child_id bigint references children(id) on delete cascade,
  plan_code text not null check (plan_code in ('sprout','builder','pathfinder','creator')),
  committed_units integer not null check (committed_units > 0),
  bonus_units integer not null default 0 check (bonus_units >= 0),
  maturity_at timestamptz not null,
  status text not null default 'active' check (status in ('active','matured','cancelled','simulation')),
  funding_mode text not null default 'units' check (funding_mode in ('units','simulation')),
  created_at timestamptz not null default now()
);
create index if not exists future_unit_plans_user_idx on future_unit_plans(user_id, created_at desc);

create table if not exists studio_projects (
  id text primary key,
  user_id text not null references "user"("id") on delete cascade,
  child_id bigint references children(id) on delete set null,
  title text not null,
  category text not null check (category in ('drawing','coloring','craft','story','shirt','music','game','puzzle','animation')),
  age_band text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_projects_user_idx on studio_projects(user_id, updated_at desc);

create table if not exists learning_progress (
  id bigserial primary key,
  user_id text not null references "user"("id") on delete cascade,
  child_id bigint references children(id) on delete cascade,
  activity_key text not null,
  age_band text not null,
  level text not null,
  score integer not null default 0,
  completions integer not null default 0,
  last_completed_at timestamptz,
  unique(user_id, child_id, activity_key)
);
create index if not exists learning_progress_user_idx on learning_progress(user_id, child_id);
