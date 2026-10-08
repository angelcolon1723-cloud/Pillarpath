-- Plaza Live + parent-approved friends.
--
-- 1. plaza_friend_invites: a parent generates a friend code for their
--    child and shares it with another parent (outside the app).
-- 2. plaza_friendships: created when the second parent redeems a code for
--    their child. Status 'pending' until the FIRST parent (code owner)
--    also approves — both parents have explicitly said yes before the two
--    children can ever see each other in the plaza. No other path exists.
-- 3. plaza_presence: live position heartbeats for Go Live mode. Rows go
--    stale after ~15 seconds; the server only ever returns peers who are
--    family (same account), approved friends, or approved classmates.
-- 4. plaza_live_settings: per-child parent switch for Live mode.

create table if not exists plaza_friend_invites (
  id serial primary key,
  user_id text not null,
  child_id integer not null references children(id) on delete cascade,
  code text not null unique,
  status text not null default 'pending', -- pending | used | expired | cancelled
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists plaza_friend_invites_user_idx on plaza_friend_invites (user_id, child_id);

create table if not exists plaza_friendships (
  id serial primary key,
  user_a text not null,
  child_a integer not null references children(id) on delete cascade,
  user_b text not null,
  child_b integer not null references children(id) on delete cascade,
  status text not null default 'pending', -- pending | approved
  created_at timestamptz not null default now(),
  unique (child_a, child_b)
);
create index if not exists plaza_friendships_a_idx on plaza_friendships (child_a);
create index if not exists plaza_friendships_b_idx on plaza_friendships (child_b);

create table if not exists plaza_presence (
  child_id integer primary key references children(id) on delete cascade,
  user_id text not null,
  x double precision not null default 0,
  z double precision not null default 0,
  face double precision not null default 0,
  action text not null default '',
  action_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists plaza_presence_user_idx on plaza_presence (user_id, updated_at);

create table if not exists plaza_live_settings (
  child_id integer primary key references children(id) on delete cascade,
  user_id text not null,
  live_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
