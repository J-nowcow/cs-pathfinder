-- 로그인 사용자의 판 자국(잔디) 서버 보관 (C4)
--
-- 클라이언트의 StreakState는 날짜 -> nodeId 배열 맵(csqt.streak.v1)이다.
-- 서버는 배열 대신 행으로 편다 — (user, 날짜, 노드) 세 짝이 자연키이고,
-- 복합 PK가 "그날 같은 질문은 한 번만"을 DB 차원에서 보증한다.
-- 병합은 insert on conflict do nothing 뿐이다. 지우는 경로가 없다 —
-- 잔디는 이력이지 상태가 아니다.
--
-- read_date는 클라이언트가 KST 기준으로 정한 날짜 문자열을 그대로 받는다.
-- 서버가 now()로 다시 정하면 자정 근처 업로드가 다른 날로 적힌다.
--
-- 상한(MAX_DAYS 400 · MAX_PER_DAY 200)은 localStorage 저장 실패 대비라
-- 서버에는 걸지 않는다 — journey와 같은 원칙.

create table if not exists streak_read (
  user_id    text not null references "user" ("id") on delete cascade,
  read_date  date not null,
  qnode_id   uuid not null references qnode (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, read_date, qnode_id)
);
