-- Family device-linking invites (pairing codes).
-- A parent generates a code; the child enters it on their device to link.

create table if not exists family_invites (
  id serial primary key,
  user_id text not null,
  child_id integer references children(id) on delete cascade,
  code text not null unique,
  status text not null default 'pending',
  -- 'pending'        code generated, waiting for the child to enter it
  -- 'awaiting_approval' child entered the code; parent must approve the device
  -- 'linked'         parent approved — devices are connected
  -- 'denied'         parent rejected the device
  -- 'expired'        code timed out
  -- 'cancelled'      parent cancelled before redemption
  device_info text,
  ip_address text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists family_invites_user_idx on family_invites(user_id);
create index if not exists family_invites_code_idx on family_invites(code);

-- Null = device not linked yet. Set when the parent approves the device.
alter table children add column if not exists linked_at timestamptz;
