/**
 * 등가로 접힌 잉여를 거르는 SQL 조각.
 *
 * B6가 중복 쌍을 `qnode_equivalence`에 기록하고 남길 쪽을 `canonical_id`로
 * 박았다. 화면(목록·지도)은 정본만 세운다 — 같은 질문이 두 번 뜨는 것이
 * 중복 정리의 체감이다.
 *
 * **주소는 접지 않는다.** `/q/잉여번호`는 계속 산다(`loadNode`는 이 조각을
 * 안 쓴다). 옛 링크를 죽이는 것은 정리가 아니라 파손이다.
 *
 * 한 곳에 두는 이유 — 목록과 지도가 각자 이 조건을 들고 있으면 한쪽만
 * 고친 날 "목록엔 없는데 지도엔 있는" 질문이 생긴다. `MIN_RELATION_VOTES`를
 * 공유 상수로 올린 것과 같은 결이다.
 *
 * 조건: 활성 등가 쌍에 속해 있고, 그 쌍의 정본이 자신이 아니다.
 * `?`는 호출부의 qnode 별칭으로 치환된다.
 */
export const NOT_FOLDED_SQL = (alias: string) => `
  not exists (
    select 1 from qnode_equivalence e
     where e.active
       and e.canonical_id is not null
       and (e.node_a = ${alias}.id or e.node_b = ${alias}.id)
       and e.canonical_id <> ${alias}.id
  )`

/**
 * 접힌 노드를 정본으로 이어 주는 조인 조각.
 *
 * `NOT_FOLDED_SQL`이 잉여를 화면에서 **지우는** 쪽이라면 이것은 옛 이름으로
 * 찾아온 것을 정본으로 **안내하는** 쪽이다. 주소를 살려 둔 것과 같은 이유다.
 *
 * 주소만 살려서는 부족하다는 것이 실제로 드러났다. 학습 트랙처럼 질문
 * **문장**을 키로 들고 있는 정적 데이터가 있는데, 접기가 그 문장을 목록에서
 * 지우니 트랙이 자기 질문을 잃고 홈이 통째로 500이 났다. 등가 21쌍 중
 * 2쌍의 잉여가 트랙에 있었다.
 *
 * 한 노드가 여러 쌍에 속할 수 있어 `limit 1`로 한 줄만 집는다. 정본이 또
 * 접히는 사슬은 만들지 않는다는 전제다 — `mark-duplicates`가 정본을 잉여로
 * 삼지 않는다.
 *
 * `${alias}`는 호출부의 qnode 별칭으로 치환되고, 결과는 `canon`으로 받는다.
 */
export const CANONICAL_JOIN_SQL = (alias: string) => `
  left join lateral (
    select c.id, c.primary_category, c.level
      from qnode_equivalence e
      join qnode c on c.id = e.canonical_id
     where e.active
       and e.canonical_id is not null
       and (e.node_a = ${alias}.id or e.node_b = ${alias}.id)
       and e.canonical_id <> ${alias}.id
     limit 1
  ) canon on true`
