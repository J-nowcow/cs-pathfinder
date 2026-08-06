create type expansion_verdict as enum ('accepted', 'rejected', 'error');
create type generation_status as enum ('running', 'done', 'failed');

-- used와 reserved를 나눈다.
-- 호출 전 reserved를 올리고, 성공하면 used로 옮기고, 실패하면 되돌린다.
-- 호출 전에 차감하면 실패 시 환불 경쟁이 생기고
-- 호출 후에 차감하면 한도 초과 비용이 먼저 발생한다.
create table usage_quota (
  key      text not null,
  date     date not null,
  used     int not null default 0,
  reserved int not null default 0,
  primary key (key, date),
  constraint usage_quota_non_negative check (used >= 0 and reserved >= 0)
);

-- 같은 질문을 두 사람이 동시에 파면 LLM 호출이 두 번 나간다.
-- 유일키는 중복 행만 막지 중복 비용은 못 막으므로 리스로 선점한다.
create table generation_job (
  normalized_hash text primary key,
  status          generation_status not null,
  lease_until     timestamptz not null,
  qnode_id        uuid references qnode(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 사용자 원문은 전역 공개 테이블에서 격리한다.
-- 이름·내부 URL·토큰이 섞여 들어올 수 있다.
create table expansion_event (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid,
  parent_qnode_id    uuid references qnode(id) on delete set null,
  raw_input          text not null,
  verdict            expansion_verdict not null,
  reject_reason      text,
  resulting_qnode_id uuid references qnode(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index expansion_event_created_idx on expansion_event (created_at desc);

create table topic_seed (
  id          uuid primary key default gen_random_uuid(),
  term        text not null,
  category    text not null,
  consumed_at timestamptz,
  unique (term, category)
);

create index topic_seed_unconsumed_idx on topic_seed (category) where consumed_at is null;
