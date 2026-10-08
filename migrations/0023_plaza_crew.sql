-- Plaza Crew: other students (siblings in the same family today, classroom
-- crews next) join your plaza and help with quests. Each helping action in
-- the plaza (a good quest choice, facing a Doubtling) counts as one "help"
-- toward a shared weekly Crew Quest. Helps pool across the whole crew;
-- when the goal is met, every crew member can claim the reward once.
-- Progress lives server-side so it is shared across devices and cannot be
-- farmed by clearing local storage.

create table if not exists plaza_crew_helps (
  user_id text not null,
  child_id integer not null references children(id) on delete cascade,
  week_key date not null,
  helps integer not null default 0,
  claimed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, child_id, week_key)
);
create index if not exists plaza_crew_helps_user_week_idx on plaza_crew_helps (user_id, week_key);
