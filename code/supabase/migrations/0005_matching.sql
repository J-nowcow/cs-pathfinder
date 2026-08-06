-- 후보 매칭 전환 (스펙 개정 2)
--
-- 정규화 해시로 캐시를 맞추는 방식이 실호출에서 무너졌다(스펙 부록 D).
-- 같은 뜻의 세 표현이 세 개의 canonical 문장이 돼서 해시가 갈라졌다.
-- 이제 주 매칭은 "이미 있는 후보 중 고르기"가 맡는다.

-- 노드를 물리적으로 합치지 않는다. 지금은 같다고 본다는 사실만 기록한다.
-- occurrence는 원래 qnode_id를 계속 붙들고 있으므로 관계만 끊으면 되돌아간다.
-- 초판에서 "복구 불가"였던 오병합이 이 테이블로 복구 가능해진다.
create table qnode_equivalence (
  id          uuid primary key default gen_random_uuid(),
  node_a      uuid not null references qnode(id) on delete cascade,
  node_b      uuid not null references qnode(id) on delete cascade,
  decided_by  text not null,
  decision_id uuid references expansion_event(id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  -- 정렬해 저장해야 (a,b)와 (b,a)가 중복으로 안 들어간다
  constraint qnode_equivalence_ordered check (node_a < node_b),
  unique (node_a, node_b)
);

create index qnode_equivalence_a_idx on qnode_equivalence (node_a) where active;
create index qnode_equivalence_b_idx on qnode_equivalence (node_b) where active;

-- 임베딩은 쓰기만 켜고 검색은 끈다.
-- 나중에 검색을 켤 때 백필 재임베딩이 필요 없게 지금부터 채운다.
--
-- 타입을 pgvector가 아니라 real[]로 두는 이유는 검색이 아직 없어서다.
-- 유사도 연산이 필요해지는 시점에 vector로 옮긴다. 값은 그대로 살아 있다.
alter table qnode add column embedding real[];

-- 매칭 결정의 근거를 남긴다. 나중에 철회하려면 무엇을 보고 골랐는지 알아야 한다.
alter table expansion_event add column candidate_ids uuid[];
alter table expansion_event add column matched_node_id uuid references qnode(id) on delete set null;
alter table expansion_event add column gate_version text;
