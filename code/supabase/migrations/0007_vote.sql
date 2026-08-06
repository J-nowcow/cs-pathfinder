-- 트리 추천
--
-- 게시판에 "인기" 정렬 탭이 있는데 누를 곳이 없어 upvotes가 전부 0이었다.
-- 정렬이 사실상 최신순과 같았고 카드도 숫자를 숨기고 있었다.
--
-- 식별은 쿠키다. IP로 하면 국내 모바일 캐리어의 NAT 뒤에서 한 사람이 누른 뒤
-- 같은 출구를 쓰는 사람들이 전부 막힌다. 쿠키는 지우면 다시 누를 수 있지만,
-- 진짜 사용자를 막는 실패가 중복 한 표보다 나쁘다.
--
-- 인증이 붙으면 voter_key를 검증된 UID로 바꾼다. 그때 쿠키 키는 그대로 두고
-- 새 키로만 쌓으면 과거 표를 잃지 않는다.

create table tree_vote (
  tree_id    uuid not null references tree(id) on delete cascade,
  voter_key  text not null,
  created_at timestamptz not null default now(),
  primary key (tree_id, voter_key)
);

-- 한 사람이 누른 트리를 한 번에 읽는다. 게시판에서 이미 누른 것을 표시할 때 쓴다.
create index tree_vote_voter_idx on tree_vote (voter_key);
