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
