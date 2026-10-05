-- CJ API token cache: one row, reused across serverless invocations so we
-- don't burn CJ's 1 QPS token rate limit fetching a fresh token per call.
-- CJ access tokens live 180 days; we refresh a day early.

create table if not exists cj_token_cache (
  id int primary key default 1 check (id = 1),
  access_token text not null,
  refresh_token text not null default '',
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
