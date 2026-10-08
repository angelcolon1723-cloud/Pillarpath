-- Pillar Plaza goes server-side: the game and the app work as one system.
--
-- 1. plaza_saves: cloud save per child. The plaza writes here (debounced);
--    on entry the newer of server/local wins, so progress survives reinstalls
--    and follows the kid across devices.
-- 2. plaza_events: curated plaza milestones, surfaced in the parent dashboard
--    "Plaza activity" feed. The game stays alive in the app.
-- 3. plaza_reward_caps: tamper-proof daily caps for plaza Unit rewards.
--    Clearing localStorage cannot farm rewards — the caps live in Postgres,
--    scoped per account + child + cap key + day.

create table if not exists plaza_saves (
  child_id integer primary key references children(id) on delete cascade,
  user_id text not null,
  save_json jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists plaza_saves_user_idx on plaza_saves (user_id);

create table if not exists plaza_events (
  id serial primary key,
  user_id text not null,
  child_id integer not null references children(id) on delete cascade,
  icon text not null default '🏙️',
  headline text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists plaza_events_user_idx on plaza_events (user_id, created_at desc);
create index if not exists plaza_events_child_idx on plaza_events (child_id, created_at desc);

create table if not exists plaza_reward_caps (
  user_id text not null,
  child_id integer not null references children(id) on delete cascade,
  cap_key text not null,
  day date not null,
  count integer not null default 0,
  primary key (user_id, child_id, cap_key, day)
);
