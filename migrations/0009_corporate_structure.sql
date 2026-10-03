-- 0009: PillarPath corporate structure — departments, roles, permissions, team.
-- Reference data (departments/roles/permissions) is seeded idempotently from
-- src/lib/corporate-structure.ts by seedCorporateStructure(); this migration
-- only creates the tables.

create table if not exists corporate_departments (
  id serial primary key,
  slug text unique not null,
  name text not null,
  tagline text not null default '',
  icon text not null default '🏢',
  sort_order int not null default 0,
  mandate text not null default '',
  room text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists corporate_roles (
  id serial primary key,
  slug text unique not null,
  title text not null,
  department_id int not null references corporate_departments(id) on delete cascade,
  level int not null check (level between 1 and 10),
  summary text not null default '',
  responsibilities text not null default '[]',
  is_executive boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists corporate_roles_dept_idx on corporate_roles(department_id);

create table if not exists corporate_role_permissions (
  role_id int not null references corporate_roles(id) on delete cascade,
  resource text not null,
  action text not null,
  primary key (role_id, resource, action)
);

create table if not exists corporate_team (
  id bigserial primary key,
  user_id text not null references "user"("id") on delete cascade,
  role_id int not null references corporate_roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  granted_by text references "user"("id") on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  note text not null default ''
);
create index if not exists corporate_team_user_idx on corporate_team(user_id) where status = 'active';
create index if not exists corporate_team_role_idx on corporate_team(role_id) where status = 'active';
