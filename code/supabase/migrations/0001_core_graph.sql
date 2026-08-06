-- gen_random_uuid()는 Postgres 13+ 코어에 있다. 확장이 필요 없다.

create type qnode_status as enum ('pending', 'ready', 'failed');
create type qnode_origin as enum ('batch', 'on_demand');

create table qnode (
  id                  uuid primary key default gen_random_uuid(),
  identity_scope      text not null,
  normalized_question text not null,
  body                text not null default '',
  primary_category    text not null,
  status              qnode_status not null default 'pending',
  origin              qnode_origin not null,
  created_at          timestamptz not null default now()
);

create index qnode_ready_idx on qnode (status) where status = 'ready';

-- 정규화 결과 바인딩.
-- 정규화기 버전별로 분리해 모델·프롬프트를 바꿔도 기존 노드를 잃지 않는다.
create table qnode_alias (
  id                 uuid primary key default gen_random_uuid(),
  normalizer_version text not null,
  normalized_hash    text not null,
  qnode_id           uuid not null references qnode(id) on delete cascade,
  created_at         timestamptz not null default now(),
  unique (normalizer_version, normalized_hash)
);

create index qnode_alias_node_idx on qnode_alias (qnode_id);

-- 전역 그래프는 DAG가 아니다. 순환을 허용한다.
-- 지식 관계에서 TCP → 3-way handshake 와 그 역은 둘 다 성립한다.
-- 조상 중복은 경로 생성 시점에만 막는다.
create table qedge (
  parent_id  uuid not null references qnode(id) on delete cascade,
  child_id   uuid not null references qnode(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, child_id),
  constraint qedge_no_self check (parent_id <> child_id)
);

create index qedge_child_idx on qedge (child_id);

create table qnode_suggestion (
  id             uuid primary key default gen_random_uuid(),
  qnode_id       uuid not null references qnode(id) on delete cascade,
  text           text not null,
  target_node_id uuid references qnode(id) on delete set null,
  position       int not null,
  created_at     timestamptz not null default now(),
  unique (qnode_id, position)
);

create index qnode_suggestion_parent_idx on qnode_suggestion (qnode_id, position);
