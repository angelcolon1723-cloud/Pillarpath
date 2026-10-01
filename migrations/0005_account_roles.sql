-- 0005_account_roles.sql
--
-- Four-sided accounts, Phase 1: the server learns every account's role.
--
-- * `"user".role` — 'parent' | 'teacher' | 'admin'. NEVER 'child': children
--   are profiles under a parent account, not users (COPPA). New signups are
--   forced to 'parent' by the Better Auth create hook (src/lib/auth/server.ts);
--   the client can never self-assign teacher/admin because the field is
--   registered with `input: false`.
-- * `"user".teacher_status` — verification state for teacher accounts
--   (unverified | pending | approved | rejected). Enforced in Phase 4.
-- * `"user".role_set_at` — when the account holder picked their role in the
--   post-signup picker. NULL = hasn't picked yet (shows the picker).
-- * `teacher_verifications` — evidence queue for teacher verification (Phase 4).
-- * `admin_invites` — single-use, email-bound admin invites (Phase 4).
-- * `admin_audit_log` — every privileged admin write is logged (Phase 4).

alter table "user" add column if not exists role text not null default 'parent';
alter table "user" add column if not exists teacher_status text not null default 'unverified';
alter table "user" add column if not exists role_set_at timestamptz;

-- Guard the role domain for rows written outside the app (psql, etc.).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_role_check') then
    alter table "user" add constraint user_role_check
      check (role in ('parent', 'teacher', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_teacher_status_check') then
    alter table "user" add constraint user_teacher_status_check
      check (teacher_status in ('unverified', 'pending', 'approved', 'rejected'));
  end if;
end $$;

-- Existing accounts predate the picker: they keep role='parent' from the
-- column default and get the one-time "confirm your role" interstitial
-- because role_set_at stays NULL.
update "user" set role = 'parent' where role is null;

create table if not exists teacher_verifications (
  user_id text primary key references "user" ("id") on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  school_email text,
  evidence_url text,
  reviewed_by text references "user" ("id") on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists admin_invites (
  token_hash text primary key,
  email text not null,
  created_by text references "user" ("id") on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_invites_email_idx on admin_invites (email);

create table if not exists admin_audit_log (
  id bigserial primary key,
  admin_user_id text references "user" ("id") on delete set null,
  action text not null,
  target text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_admin_idx on admin_audit_log (admin_user_id);
create index if not exists admin_audit_log_created_idx on admin_audit_log (created_at desc);
