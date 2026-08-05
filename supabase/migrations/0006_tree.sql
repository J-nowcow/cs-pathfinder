-- 콘텐츠 단위로서의 트리 (스펙 §5)
--
-- 오늘의 질문과 사용자 공유 트리를 한 테이블로 통합한다. kind만 다르다.
-- 게시판 정렬·상세 보기가 종류에 상관없이 같은 코드로 돌아간다.

create type tree_kind as enum ('daily', 'shared');

create table tree (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  kind         tree_kind not null,
  category     text not null,
  root_node_id uuid not null references qnode(id) on delete cascade,
  -- daily만 채운다. 어느 시드가 소비됐는지 추적한다
  seed_id      uuid references topic_seed(id) on delete set null,
  -- 인증이 붙기 전까지 항상 null이다
  author_id    uuid,
  summary      text not null default '',
  upvotes      int not null default 0,
  views        int not null default 0,
  publish_date date,
  published_at timestamptz not null default now(),
  -- daily는 하루에 하나다. HTTP 응답만 유실돼도 재시도가 중복 발행할 수 있어
  -- DB 차원에서 막는다
  constraint tree_daily_needs_date check (kind <> 'daily' or publish_date is not null)
);

create unique index tree_daily_one_per_day on tree (publish_date) where kind = 'daily';
create index tree_board_recent_idx on tree (published_at desc);
create index tree_board_popular_idx on tree (upvotes desc, published_at desc);
create index tree_board_category_idx on tree (category, published_at desc);

-- 공유 시점의 구조를 그대로 박제한다.
--
-- 노드 id 배열로 두면 스냅샷이 아니다. 공유한 뒤 그 안의 두 노드 사이에 새 qedge가
-- 생기면 과거에 공유한 트리의 모양이 저절로 바뀐다. 부모를 명시적으로 들고 있어야
-- 그때 그 트리가 남는다.
create table tree_occurrence (
  id                   uuid primary key default gen_random_uuid(),
  tree_id              uuid not null references tree(id) on delete cascade,
  qnode_id             uuid not null references qnode(id) on delete cascade,
  parent_occurrence_id uuid references tree_occurrence(id) on delete cascade,
  position             int not null default 0
);

create index tree_occurrence_tree_idx on tree_occurrence (tree_id, parent_occurrence_id, position);
