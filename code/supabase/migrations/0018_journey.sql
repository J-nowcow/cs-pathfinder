-- 로그인 사용자의 여정 서버 보관 (C4)
--
-- 모양은 tree_occurrence(0006)와 같다 — 노드 id 배열이 아니라 부모를
-- 명시적으로 든 발자국. 나중에 두 노드 사이 qedge가 생겨도 과거 여정의
-- 모양이 안 바뀐다. src/lib/journey/types.ts가 클라이언트에서 같은 모양을
-- 이미 들고 있다.
--
-- path_key: 뿌리부터 이 발자국까지의 nodeId를 '>'로 이은 것. 발자국의
-- 정체성이다 — occurrence id는 브라우저가 만들어 기기마다 다르므로 id로는
-- 병합할 수 없다. 생성 컬럼이 아니라 저장 값인 이유: 부모가 안 바뀌므로
-- 삽입 시점에 고정해도 안전하고, 병합 때마다 재귀 계산하면 비싸다.
--
-- unique (user_id, path_key)가 병합 규칙("더하기만, 중복 없음")을 DB
-- 차원에서 보증한다. 응답 유실 후 재시도가 중복을 넣으려 하면 on conflict
-- do nothing으로 받는다 — tree_daily_one_per_day(0006)와 같은 발상.
--
-- user_id가 uuid가 아니라 text인 이유: better-auth의 "user"."id"(0017)가
-- text다. 어긋난 타입으로 FK를 걸 수 없다.
--
-- 서버는 전체를 보관한다. 400개 상한(pruneJourney)은 localStorage 저장
-- 실패 대비이지 서버 제약이 아니다.

create table if not exists journey_occurrence (
  id                   uuid primary key default gen_random_uuid(),
  user_id              text not null references "user" ("id") on delete cascade,
  qnode_id             uuid not null references qnode (id) on delete cascade,
  parent_occurrence_id uuid references journey_occurrence (id) on delete cascade,
  position             int  not null,
  path_key             text not null,
  created_at           timestamptz not null default now(),
  unique (user_id, path_key)
);

create index if not exists journey_occurrence_user_idx
  on journey_occurrence (user_id, position);
-- 인덱스 없는 참조 열은 부모를 지울 때 자식 테이블을 통째로 훑는다 (0008과 같은 이유)
create index if not exists journey_occurrence_parent_idx
  on journey_occurrence (parent_occurrence_id);

-- 지금 서 있는 자리. 사용자당 하나뿐이라 발자국 표가 아니라 따로 든다.
-- 병합 때 로컬 currentId가 우선이고, 이 표는 "다른 기기에서 이어볼 자리"다.
create table if not exists journey_cursor (
  user_id       text primary key references "user" ("id") on delete cascade,
  occurrence_id uuid not null references journey_occurrence (id) on delete cascade,
  updated_at    timestamptz not null default now()
);
