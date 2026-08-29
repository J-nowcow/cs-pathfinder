-- 진단 퀴즈의 답한 기록 (로그인 사용자만)
--
-- 문제 자체는 여기 없다. `data/quiz.ts`가 원본이고 앱이 그대로 읽는다.
-- 정적 자산을 DB로 복사하면 두 벌이 되고 어느 쪽이 진짜인지 흐려진다.
-- topic_seed나 qnode와 다른 점이다 — 그쪽은 사용자가 만든 것이 섞이지만
-- 문제는 전부 커밋된 것이라 DB에 실을 이유가 없다.
--
-- 익명 사용자는 localStorage(csqt.quiz.v1)에만 남는다. streak_read와 같은
-- 원칙이다 — 서버는 로그인한 사람의 기기 간 동기화만 맡는다.
--
-- item_index는 items[] 안의 자리다. 문제에 별도 id를 두지 않는다 —
-- 문제는 노드에 종속된 배열이고 그 순서가 정체성이다. 그래서 순서를 바꾸면
-- 기존 기록이 다른 문제를 가리킨다. `npm run verify:quiz`가 "문제를 지우거나
-- 순서를 바꾸지 말고 뒤에 붙인다"를 강제한다.
--
-- 다시 풀면 덮어쓴다. 두 번째 시도가 진짜 이해일 수 있고, 첫 오답을 영구
-- 낙인으로 남길 이유가 없다. 정답률 통계가 필요해지면 이력 테이블을 따로 판다.

create table if not exists quiz_answer (
  user_id     text     not null references "user" ("id") on delete cascade,
  qnode_id    uuid     not null references qnode (id) on delete cascade,
  item_index  smallint not null,
  chosen      smallint not null,
  correct     boolean  not null,
  answered_at timestamptz not null default now(),
  primary key (user_id, qnode_id, item_index)
);

-- "내가 틀린 지점"을 지도와 학습 기록에서 훑는다. 사용자별로 오답만 모으는
-- 질의가 주 용도라 부분 인덱스로 좁힌다.
create index if not exists quiz_answer_wrong_idx
  on quiz_answer (user_id, qnode_id)
  where not correct;
