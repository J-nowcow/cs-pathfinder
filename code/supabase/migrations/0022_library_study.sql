-- Server-owned snapshots; no direct browser database access or public policies.
-- 0021 is reserved for the user's existing staged seed-state migration.
create table if not exists library_study_snapshot (
  user_id text primary key references "user" ("id") on delete cascade,
  revision integer not null default 0 check (revision between 0 and 2147483646),
  state jsonb not null default '{"version":1,"entries":{}}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint library_state_shape check (
    jsonb_typeof(state) = 'object' and state ? 'version' and state ? 'entries'
    and state->'version' = '1'::jsonb
    and jsonb_typeof(state->'entries') = 'object'
    and octet_length(state::text) <= 4000000
  )
);
create table if not exists library_study_write (
  user_id text not null references library_study_snapshot(user_id) on delete cascade,
  request_id uuid not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  revision integer not null check (revision between 1 and 2147483646),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create index if not exists library_study_write_revision_idx on library_study_write(user_id, revision);
alter table library_study_snapshot enable row level security;
alter table library_study_write enable row level security;
revoke all on library_study_snapshot, library_study_write from public;
