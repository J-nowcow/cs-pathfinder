-- 등가 쌍에서 "남길 쪽"을 기록한다.
--
-- `qnode_equivalence`는 쌍만 담고(node_a < node_b 정렬) 어느 쪽이 정본인지
-- 담을 자리가 없었다. B6 중복 정리에서 남길 쪽을 관계 수·판 경로·번호로
-- 정했는데, **저장하지 않으면 그 판정이 사라진다** -- 2026-08-07 전수
-- 대조의 잉여 31편 목록이 정확히 그렇게 사라져서 이번에 다시 만들었다.
--
-- 관계 수는 시간이 지나면 변하므로 "나중에 다시 계산"은 같은 답을 주지
-- 않는다. 판정 시점의 결정을 그대로 둔다.
--
-- null 허용: 정본을 안 정한 등가(게이트가 만든 것 등)도 유효하다.
alter table qnode_equivalence
  add column canonical_id uuid references qnode(id) on delete set null;
