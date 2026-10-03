-- 0010: Parent-teacher messaging links + Tower secure messaging.
--
-- Parents were missing from the messaging loop entirely: family_threads and
-- classroom_connections only stored display names. Linking them to parent
-- accounts completes two-way teacher<->parent messaging.
--
-- corporate_* tables power the Tower's internal secure messaging: team
-- channels, announcements, and direct messages. All access is gated
-- server-side to active corporate team members.

alter table classroom_connections
  add column if not exists parent_user_id text references "user"("id") on delete set null;
alter table family_threads
  add column if not exists parent_user_id text references "user"("id") on delete set null;
create index if not exists classroom_connections_parent_idx on classroom_connections(parent_user_id);
create index if not exists family_threads_parent_idx on family_threads(parent_user_id);

create table if not exists corporate_channels (
  id uuid primary key,
  name text not null,
  description text not null default '',
  is_announcement boolean not null default false,
  is_dm boolean not null default false,
  created_by text references "user"("id") on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists corporate_channel_members (
  channel_id uuid not null references corporate_channels(id) on delete cascade,
  user_id text not null references "user"("id") on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists corporate_channel_members_user_idx on corporate_channel_members(user_id);

create table if not exists corporate_messages (
  id uuid primary key,
  channel_id uuid not null references corporate_channels(id) on delete cascade,
  sender_user_id text not null references "user"("id") on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists corporate_messages_channel_idx on corporate_messages(channel_id, created_at);
