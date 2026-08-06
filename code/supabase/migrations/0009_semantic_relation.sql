-- 지식 사이의 의미 관계.
--
-- `qedge`와 다른 것을 담는다. debate에서 확인한 것은 하나의 `qedge`가 세 가지
-- 일을 하고 있다는 점이었다.
--
--   전이   사용자가 실제로 A에서 B로 걸어갔다
--   동일성 A와 B는 같은 질문이다 (qnode_equivalence)
--   관계   A와 B는 다르지만 관련 있다  ← 담을 곳이 없었다
--
-- 셋은 생기는 방식도, 필요한 정확도도, 되돌리는 방법도 다르다.
--
-- 특히 정확도가 다르다. 동일성은 틀리면 두 질문이 하나로 합쳐져 복구가 어렵다.
-- 관계는 틀려도 선 하나가 잘못 그려질 뿐이고 `active`를 내리면 끝난다. 그래서
-- 관계는 precision 100%를 요구하지 않는다.
--
-- 이 구분이 필요한 이유는 실측에서 나왔다. 꼬리질문이 기존 질문과 **같은** 경우는
-- 5%뿐이었다(방법을 둘로 바꿔 재도 같았다). 꼬리질문은 기존 질문의 다른 표현이
-- 아니라 한 층 더 깊은 새 질문이기 때문이다. 동일성만으로는 그물이 안 된다.
create type relation_kind as enum (
  -- 두 질문이 같은 밑바탕을 다룬다. "GC 멈춤"과 "STW는 왜 필요한가"
  'shares_concept',
  -- 앞의 것을 알아야 뒤의 것이 읽힌다. "TCP"와 "3-way handshake"
  'prerequisite',
  -- 같은 문제의 다른 선택지. "낙관적 락"과 "비관적 락"
  'alternative',
  -- 한쪽이 다른 쪽의 구체적인 사례. "캐시 전략"과 "Redis TTL 설정"
  'instance_of'
);

-- 관계를 누가 만들었나. 되돌릴 때 무엇을 지울지 정하는 근거다.
create type relation_source as enum (
  'llm',    -- 판정으로 만든 것. 틀릴 수 있다
  'human',  -- 사람이 확인한 것
  'seed'    -- 데이터 파일에 손으로 적은 것
);

create table semantic_relation (
  id         uuid primary key default gen_random_uuid(),
  -- 방향이 있는 관계도 있고(prerequisite) 없는 것도 있다(alternative).
  -- 없는 쪽은 양방향으로 읽되 행은 하나만 둔다. 두 벌을 두면 한쪽만 지워지는
  -- 상태가 생긴다.
  from_id    uuid not null references qnode(id) on delete cascade,
  to_id      uuid not null references qnode(id) on delete cascade,
  kind       relation_kind not null,
  source     relation_source not null,
  -- 왜 이었는지 한 줄. 나중에 사람이 검수할 때 이것만 읽고 판단한다.
  -- 근거를 못 적는 관계는 만들지 않는다는 뜻이기도 하다.
  reason     text not null default '',
  -- 판정을 여러 번 뽑았을 때 몇 번이 찬성했나. 측정이 회차마다 7~17%로
  -- 흔들리는 것을 봤기 때문에 처음부터 다수결을 전제한다.
  votes      int not null default 1,
  -- 내리면 화면에서 사라진다. 지우지 않는 이유는 왜 내렸는지가 남아야 해서다.
  active     boolean not null default true,
  created_at timestamptz not null default now(),

  constraint semantic_no_self check (from_id <> to_id)
);

-- 같은 두 노드에 같은 종류의 관계를 두 번 만들지 않는다.
-- 종류가 다르면 허용한다 — "관련 있고" 동시에 "선행 지식"일 수 있다.
create unique index semantic_relation_pair_idx
  on semantic_relation (from_id, to_id, kind);

-- 지도가 한 노드의 관계를 양쪽에서 찾는다
create index semantic_relation_from_idx on semantic_relation (from_id) where active;
create index semantic_relation_to_idx   on semantic_relation (to_id)   where active;
