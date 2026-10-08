-- Plaza device passes — the kid-device pass (Phase 2 identity, plaza scope).
--
-- A parent issues a pass for one child from the dashboard. The kid enters
-- it once on their own device; the plaza then talks to the server AS that
-- child for plaza features only (economy with the same caps + audit, cloud
-- saves, crew, friends, Live). Only a SHA-256 hash of the token is stored.
-- Parents can revoke a pass at any time; revocation is effective on the
-- next request. A pass grants no access to any other part of the app —
-- every other server function still requires a full account session.

create table if not exists plaza_device_passes (
  id serial primary key,
  user_id text not null,
  child_id integer not null references children(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Kid device',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists plaza_device_passes_child_idx on plaza_device_passes (child_id) where revoked_at is null;
