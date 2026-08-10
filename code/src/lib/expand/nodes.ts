import { getDb } from '@/lib/db/client'
import { isMissingTable } from '@/lib/db/missing-table'
import { MIN_RELATION_VOTES } from '@/lib/db/relations'
import {
  EMBED_DIM,
  EMBED_TOP_K,
  EMBED_MIN_SIMILARITY,
  RELATION_MIN_SIMILARITY,
} from '@/lib/embed/model'

export type NewNode = {
  identityScope: string
  normalizedQuestion: string
  body: string
  primaryCategory: string
  status?: 'pending' | 'ready' | 'failed'
  origin: 'batch' | 'on_demand'
}

export async function insertNode(node: NewNode): Promise<string> {
  const db = await getDb()
  const rows = await db.query<{ id: string }>(
    /*
     * `number`를 손으로 적는다. `0011`에서 컬럼 기본값을 뗐기 때문이다 --
     * 기본값은 `on conflict` 경로에서 번호를 태웠다. 여기는 충돌 절이 없어
     * 한 행에 한 번만 돈다.
     */
    `insert into qnode
       (identity_scope, normalized_question, body, primary_category, status, origin, number)
     values ($1, $2, $3, $4, $5, $6, nextval('qnode_number_seq'))
     returning id`,
    [
      node.identityScope,
      node.normalizedQuestion,
      node.body,
      node.primaryCategory,
      node.status ?? 'ready',
      node.origin,
    ],
  )
  return rows[0].id
}

export async function insertSuggestions(qnodeId: string, texts: string[]): Promise<void> {
  if (texts.length === 0) return
  const db = await getDb()
  for (const [position, text] of texts.entries()) {
    await db.query(
      `insert into qnode_suggestion (qnode_id, text, position, target_node_id)
       values ($1, $2, $3, null)
       on conflict (qnode_id, position) do nothing`,
      [qnodeId, text, position],
    )
  }
}

export async function bindAlias(
  normalizerVersion: string,
  hash: string,
  qnodeId: string,
): Promise<void> {
  const db = await getDb()
  await db.query(
    `insert into qnode_alias (normalizer_version, normalized_hash, qnode_id)
     values ($1, $2, $3)
     on conflict (normalizer_version, normalized_hash) do nothing`,
    [normalizerVersion, hash, qnodeId],
  )
}

/**
 * 캐시 히트에도 간선은 추가한다.
 * 새 부모에서 기존 노드로 처음 닿았다면 그 관계가 저장되어야 한다.
 */
export async function ensureEdge(parentId: string, childId: string): Promise<void> {
  if (parentId === childId) return
  const db = await getDb()
  await db.query(
    `insert into qedge (parent_id, child_id) values ($1, $2)
     on conflict (parent_id, child_id) do nothing`,
    [parentId, childId],
  )
}

export async function resolveSuggestion(
  suggestionId: string,
): Promise<{ text: string; targetNodeId: string | null } | null> {
  const db = await getDb()
  const rows = await db.query<{ text: string; target_node_id: string | null }>(
    'select text, target_node_id from qnode_suggestion where id = $1',
    [suggestionId],
  )
  if (rows.length === 0) return null
  return { text: rows[0].text, targetNodeId: rows[0].target_node_id }
}

/**
 * 꼬리질문과 그것이 실제로 닿은 노드를 잇는다.
 *
 * 이 링크가 있어야 두 번째 클릭이 공짜가 된다. 없으면 이미 판 꼬리를 다시 눌러도
 * 매칭 게이트를 또 태우고, 화면은 어디를 이미 팠는지 표시하지 못한다.
 * `suggestion_resolved` 경로가 통째로 죽어 있던 이유가 이 갱신이 없어서였다.
 *
 * 이미 이어져 있으면 덮지 않는다. 먼저 닿은 노드가 임자다. 덮으면 같은 꼬리가
 * 누를 때마다 다른 곳으로 가고, 미니맵에 그려진 과거 경로와도 어긋난다.
 */
export async function linkSuggestion(suggestionId: string, nodeId: string): Promise<void> {
  const db = await getDb()
  await db.query(
    `update qnode_suggestion set target_node_id = $2
     where id = $1 and target_node_id is null`,
    [suggestionId, nodeId],
  )
}

/**
 * 게이트에 보여줄 후보를 모은다.
 *
 * 부모의 자식이 1순위다. 여기에 조부모의 다른 자식(1-hop)을 더한다.
 * `qedge`가 인접 리스트라 조회 한 번이면 되고, 근처에서 이미 만들어진
 * 같은 개념을 잡을 확률이 올라간다.
 *
 * **구조만 보다가 96.3%가 빈손이었다.** 운영 노드 321개에서 후보 분포를
 * 재보니 309개가 후보 0개였다(`npm run measure:candidates`). `qedge`가
 * 12행이기 때문이다. 시딩이 간선을 안 만들고, 사람이 안 걸어간 자리에는
 * 길이 없다.
 *
 * 게이트 정확도는 튜닝 124/124 · 홀드아웃 60/60이다. **정확한데 일할
 * 기회가 없었다.** 그래서 고칠 곳은 판정기가 아니라 여기다.
 *
 * 그래서 의미 관계를 후보에 더한다. `semantic_relation`은 330행 살아
 * 있었는데 매칭 경로가 그것을 안 보고 있었다.
 *
 * **구조를 앞에 둔다.** 사람이 실제로 걸어간 길이라 더 믿을 만하고,
 * 상한에 걸려 잘릴 때 잘리는 쪽은 의미여야 한다.
 *
 * 상한을 두는 이유는 프롬프트 길이와 판정 정확도 때문이다. 후보 50개까지는
 * 정확도가 유지되는 것을 실측했다(스펙 부록 D). 다만 그 실측은 표본이
 * 7건이라 신뢰구간이 49~97%다. 후보 구성을 바꿨으니 `measure:match`로
 * 다시 본다.
 */
export const MAX_CANDIDATES = 50

/*
 * 표 문턱은 `db/relations.ts`의 공유 상수를 쓴다. 화면과 매칭이 같은
 * 기준이어야 하는 이유가 그 상수의 주석에 있다.
 */

export async function collectCandidates(
  parentNodeId: string,
): Promise<Array<{ id: string; question: string }>> {
  const db = await getDb()

  const rows = await db.query<{ id: string; normalized_question: string }>(
    `with siblings as (
       select e.child_id as id, 0 as rank
       from qedge e
       where e.parent_id = $1
     ),
     uncles as (
       select e2.child_id as id, 1 as rank
       from qedge g
       join qedge e2 on e2.parent_id = g.parent_id
       where g.child_id = $1 and e2.child_id <> $1
     ),
     merged as (
       select id, min(rank) as rank from (
         select * from siblings union all select * from uncles
       ) u group by id
     )
     select n.id, n.normalized_question
     from merged m
     join qnode n on n.id = m.id
     where n.status = 'ready' and n.id <> $1
     order by m.rank asc, n.created_at asc
     limit $2`,
    [parentNodeId, MAX_CANDIDATES],
  )

  const out = rows.map((r) => ({ id: r.id, question: r.normalized_question }))
  const seen = new Set(out.map((c) => c.id))

  const add = (more: Array<{ id: string; question: string }>) => {
    for (const c of more) {
      if (out.length >= MAX_CANDIDATES) return
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
    }
  }

  /*
   * 두 의미 층은 서로 독립이라 **동시에** 묻는다.
   *
   * 여기는 확장 응답 경로다 — 사용자가 기다린다. 순차로 돌리면 Neon 왕복이
   * 최대 3번 줄지어 서는데, 뒤 질의가 앞 질의에서 실제로 받는 것은 남은
   * 자리 수뿐이고 그건 전송량 절약이지 결과를 바꾸는 의존이 아니다.
   * 각자 자기 상한만큼 가져오게 하고 자리 배분은 `add`가 순서대로 한다 —
   * 어느 행이 뽑히는지는 순차일 때와 같다.
   */
  if (out.length < MAX_CANDIDATES) {
    const [semantic, vector] = await Promise.all([
      semanticNeighbors(parentNodeId, MAX_CANDIDATES),
      vectorNeighbors(parentNodeId, EMBED_TOP_K),
    ])
    add(semantic)
    add(vector)
  }

  return out
}

/**
 * 의미로 이어진 이웃.
 *
 * **질의를 따로 낸다.** 위 CTE에 합치면 왕복이 한 번 줄지만, 표가 없을 때
 * 확장 전체가 죽는다. `semantic_relation`은 `0009`에서 생겼고 그 마이그레이션을
 * 프로덕션에 적용하지 않은 채 배포한 날 화면 전부가 500이 됐다. 지도는 선 없이
 * 그리면 되지만 확장은 이 서비스의 본체다 — **관계가 없으면 관계 없이 판다.**
 *
 * 방향은 양쪽 다 본다. 방향 없는 관계도 행은 하나만 두기 때문이다(`0009` 주석).
 */
async function semanticNeighbors(
  nodeId: string,
  limit: number,
): Promise<Array<{ id: string; question: string }>> {
  if (limit <= 0) return []
  const db = await getDb()

  try {
    const rows = await db.query<{ id: string; normalized_question: string }>(
      `select n.id, n.normalized_question
         from semantic_relation r
         join qnode n
           on n.id = case when r.from_id = $1 then r.to_id else r.from_id end
        where r.active
          and r.votes >= $3
          and (r.from_id = $1 or r.to_id = $1)
          and n.status = 'ready'
          and n.id <> $1
        group by n.id, n.normalized_question, n.created_at
        order by max(r.votes) desc, n.created_at asc
        limit $2`,
      [nodeId, limit, MIN_RELATION_VOTES],
    )
    return rows.map((r) => ({ id: r.id, question: r.normalized_question }))
  } catch (e) {
    /* 표 부재 판별은 전용 모듈을 쓴다. `graph.ts`가 같은 표 부재를 같은 함수로 잡는다 */
    if (!isMissingTable(e)) throw e
    console.warn('[expand] semantic_relation이 없다. 구조 후보만 쓴다 — npm run db:migrate')
    return []
  }
}

/**
 * 벡터로 가까운 이웃.
 *
 * **부모의 임베딩을 쓴다. 사용자가 친 문장을 임베딩하지 않는다.**
 * 그래서 이 경로에 모델 호출이 없다 -- 미리 담아 둔 값끼리 견주기만 한다.
 * 임베딩을 밤에 로컬에서 만들 수 있는 것도 이 때문이다.
 *
 * 대가는 정확도다. 사용자가 실제로 무엇을 물었는지가 아니라 "지금 보고 있는
 * 질문 근처"를 가져온다. 게이트가 어차피 후보 중에서 고르는 판정기라
 * 후보는 "이 근처일 법한 것"이면 되지만, 입력 자체로 찾는 것보다는 무디다.
 * 입력으로 찾고 싶어지면 런타임에 같은 모델을 불러야 하고, 그때는 로컬이
 * 성립하지 않는다(`lib/embed/model.ts`).
 *
 * `<=>`는 코사인 **거리**다. 유사도로 쓰려면 뒤집어야 한다.
 */
async function vectorNeighbors(
  nodeId: string,
  limit: number,
): Promise<Array<{ id: string; question: string }>> {
  if (limit <= 0) return []
  const db = await getDb()

  try {
    const rows = await db.query<{ id: string; normalized_question: string }>(
      /*
       * 차원을 문자열로 끼운다. 타입 캐스팅의 괄호 안은 파라미터를 못 받는다.
       * `EMBED_DIM`은 코드 상수(숫자)라 바깥 입력이 닿지 않는다.
       */
      `with me as (
         select embedding::vector(${EMBED_DIM}) as v
           from qnode
          where id = $1 and embedding is not null
       )
       select n.id, n.normalized_question
         from qnode n, me
        where n.status = 'ready'
          and n.id <> $1
          and n.embedding is not null
          and 1 - (n.embedding::vector(${EMBED_DIM}) <=> me.v) >= $3
        order by n.embedding::vector(${EMBED_DIM}) <=> me.v asc, n.created_at asc
        limit $2`,
      [nodeId, limit, EMBED_MIN_SIMILARITY],
    )
    return rows.map((r) => ({ id: r.id, question: r.normalized_question }))
  } catch (e) {
    /*
     * 확장이 없으면 벡터 없이 판다.
     *
     * `0012`를 프로덕션에 적용하지 않은 채 배포하면 여기가 터진다. `0009`를
     * 안 올린 날 화면 전부가 500이 됐던 것과 같은 모양이다. 확장은 덤이고
     * 확장이 본체다 -- 확장(기능)이 확장(extension) 때문에 죽으면 안 된다.
     */
    if (!isVectorUnavailable(e)) throw e
    console.warn('[expand] 벡터 후보를 못 쓴다. 구조·관계 후보만 쓴다 —', String(e).slice(0, 120))
    return []
  }
}

/**
 * 벡터 검색이 "지금 안 되는" 오류인가.
 *
 * 둘을 잡는다.
 * - 확장 없음 — `42704 undefined_object` / `42883 undefined_function`.
 *   `0012`를 프로덕션에 안 올린 채 배포한 경우다
 * - **차원 불일치** — "expected N dimensions, not M". 모델을 갈아탈 때
 *   코드(새 차원)와 DB(옛 벡터)가 잠깐 어긋난다. bge-m3(1024) →
 *   gemini(768) 전환에서 실제로 지나는 창이다. 이걸 안 잡으면 그 창
 *   동안 확장 전체가 500이다 — 벡터는 덤이고 확장이 본체다
 */
function isVectorUnavailable(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code
  if (code === '42704' || code === '42883') return true
  const msg = e instanceof Error ? e.message : String(e)
  return /type "vector" does not exist|operator does not exist.*<=>|dimensions/i.test(msg)
}

/**
 * 화면에 내보낼 관련 질문 한 줄.
 *
 * 게이트 후보(`collectCandidates`)와 담는 것이 다르다. 후보는 판정기가 읽으므로
 * id와 질문이면 되지만, 이쪽은 사람이 읽고 누른다 — 주소가 될 번호와 분류,
 * 그리고 왜 이어졌는지가 필요하다.
 */
export type RelatedNode = {
  id: string
  /** 주소가 되는 번호. `/q/{number}`로 간다 */
  number: number
  question: string
  category: string
  /** 왜 이어졌는지 한 줄. 벡터로 데려온 것은 근거가 없어 null */
  reason: string | null
}

/**
 * 한 화면에 보여줄 개수.
 *
 * 다섯을 넘으면 목록이 본문과 경쟁한다. 여기는 "다 읽었으면 다음"을 권하는
 * 자리이지 목록 화면이 아니다 — 더 보고 싶으면 `/questions`가 있다.
 */
export const RELATED_DISPLAY_LIMIT = 5

/**
 * "이거 봤으면 이것도".
 *
 * **후보 수집(`collectCandidates`)을 화면용으로 늘리지 않고 따로 둔다.**
 * 후보는 확장 핫패스에서 돌고 사용자가 그 앞에서 기다린다. 화면 사정으로
 * 컬럼을 늘리면 그 대가를 확장이 치른다. 반대로 목적도 다르다 — 후보는
 * "같은 질문인가"를 물으려고 넉넉히 모으고, 이쪽은 "다음에 읽을 것"을
 * 다섯 개로 추린다.
 *
 * **관계가 먼저, 벡터가 나중이다.** 관계는 판정을 거쳤고 왜 이었는지를
 * 문장으로 들고 있다. 벡터는 아무 판정도 안 거친 이웃이라 근거를 못 적는다.
 * 상한에 걸려 잘릴 때 잘리는 쪽은 벡터여야 한다.
 *
 * 관계로 자리가 다 차면 **벡터를 아예 안 묻는다.** `collectCandidates`가
 * 둘을 동시에 묻는 것과 다른 선택이다 — 그쪽은 35초짜리 확장 응답 안이라
 * 왕복 하나가 아깝고, 여기는 읽기 화면이라 전체 스캔 한 번을 아끼는 쪽이
 * 낫다.
 */
export async function relatedForDisplay(
  nodeId: string,
  limit: number = RELATED_DISPLAY_LIMIT,
): Promise<RelatedNode[]> {
  if (limit <= 0) return []

  const out = await relatedByRelation(nodeId, limit)
  if (out.length >= limit) return out

  const seen = new Set(out.map((r) => r.id))
  for (const v of await relatedByVector(nodeId, limit)) {
    if (out.length >= limit) break
    if (seen.has(v.id)) continue
    seen.add(v.id)
    out.push(v)
  }

  return out
}

/**
 * 판정으로 이어진 관련 질문.
 *
 * 문턱은 `MIN_RELATION_VOTES`다. 지도(`db/graph.ts`)가 선을 그리는 기준과
 * 반드시 같아야 한다 — 갈리면 **화면에 선이 없는 관계를 근거로 다음 질문을
 * 권하게 되고**, 왜 권했는지 확인할 길이 사용자에게 없다.
 *
 * `number is not null`을 건다. 목록의 링크가 `/q/{번호}`인데 번호는
 * `0011` 이후 시드 경로에서 행을 넣은 뒤에 붙으므로 잠깐 비어 있는 창이 있다.
 *
 * 같은 노드로 가는 관계가 여럿일 수 있다(`shares_concept`과 `prerequisite`).
 * `distinct on`으로 표를 가장 많이 받은 한 줄만 남긴다 — 그 줄의 이유가
 * 가장 여러 번 확인된 이유다.
 */
async function relatedByRelation(nodeId: string, limit: number): Promise<RelatedNode[]> {
  const db = await getDb()

  try {
    const rows = await db.query<{
      id: string
      number: number
      normalized_question: string
      primary_category: string
      reason: string | null
    }>(
      `with picked as (
         select distinct on (n.id)
                n.id, n.number, n.normalized_question, n.primary_category,
                n.created_at, r.reason, r.votes
           from semantic_relation r
           join qnode n
             on n.id = case when r.from_id = $1 then r.to_id else r.from_id end
          where r.active
            and r.votes >= $3
            and (r.from_id = $1 or r.to_id = $1)
            and n.status = 'ready'
            and n.id <> $1
            and n.number is not null
          order by n.id, r.votes desc
       )
       select id, number, normalized_question, primary_category, reason
         from picked
        order by votes desc, created_at asc
        limit $2`,
      [nodeId, limit, MIN_RELATION_VOTES],
    )

    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      question: r.normalized_question,
      category: r.primary_category,
      /*
       * 빈 이유는 없는 것으로 친다. 컬럼 기본값이 `''`이라(`0009`) 근거 없이
       * 저장된 관계가 화면에 빈 줄을 남기는 것을 막는다.
       */
      reason: r.reason && r.reason.trim().length > 0 ? r.reason : null,
    }))
  } catch (e) {
    /* 관련 질문은 덤이고 해설이 본체다. 표가 없으면 목록 없이 읽는다 */
    if (!isMissingTable(e)) throw e
    console.warn('[related] semantic_relation이 없다. 관계 없이 그린다 — npm run db:migrate')
    return []
  }
}

/**
 * 벡터로 가까운 관련 질문.
 *
 * 관계는 판정을 돌린 만큼만 생긴다. 판정이 안 닿은 노드에서 목록이 통째로
 * 비지 않게 이 층이 뒤를 받친다.
 *
 * **문턱은 `RELATION_MIN_SIMILARITY`(0.76)다. 매칭이 쓰는 0.85가 아니다.**
 * 두 값이 묻는 것이 다르다(`embed/model.ts`). 0.85는 "같은 질문인가"의
 * 문턱이라 그 위에 남는 것은 사실상 중복이다 — 방금 읽은 것과 같은 질문을
 * "이것도 보라"고 권하는 목록이 된다. 여기가 찾는 것은 **다르지만 이어지는**
 * 질문이고, 그 문턱이 0.76이다. 실측 분포(321편 51,360쌍)에서 0.85는
 * 99분위 위라 목록이 거의 늘 비기도 한다.
 */
async function relatedByVector(nodeId: string, limit: number): Promise<RelatedNode[]> {
  if (limit <= 0) return []
  const db = await getDb()

  try {
    const rows = await db.query<{
      id: string
      number: number
      normalized_question: string
      primary_category: string
    }>(
      /* 차원은 문자열로 끼운다. 캐스팅 괄호 안은 파라미터를 못 받는다 */
      `with me as (
         select embedding::vector(${EMBED_DIM}) as v
           from qnode
          where id = $1 and embedding is not null
       )
       select n.id, n.number, n.normalized_question, n.primary_category
         from qnode n, me
        where n.status = 'ready'
          and n.id <> $1
          and n.number is not null
          and n.embedding is not null
          and 1 - (n.embedding::vector(${EMBED_DIM}) <=> me.v) >= $3
        order by n.embedding::vector(${EMBED_DIM}) <=> me.v asc, n.created_at asc
        limit $2`,
      [nodeId, limit, RELATION_MIN_SIMILARITY],
    )

    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      question: r.normalized_question,
      category: r.primary_category,
      /* 아무 판정도 안 거쳤다. 내세울 근거가 없으면 안 적는다 */
      reason: null,
    }))
  } catch (e) {
    if (!isVectorUnavailable(e)) throw e
    console.warn('[related] 벡터를 못 쓴다. 관계만 쓴다 —', String(e).slice(0, 120))
    return []
  }
}

/**
 * 등가 관계를 기록한다.
 *
 * 노드를 물리적으로 합치지 않는다. 잘못 이었으면 active만 내리면 되고
 * occurrence는 원래 노드를 계속 붙들고 있어서 되돌릴 것이 없다.
 */
export async function linkEquivalent(
  a: string,
  b: string,
  /*
   * 'claude'를 더했다. B6 중복 정리는 모델(Claude)이 쌍을 판정했는데
   * 'human'으로 적으면 검수 기록이 거짓이 된다. 누가 정했는지가 이 표의
   * 존재 이유다 -- 되돌릴 때 무엇을 지울지 그것으로 가른다.
   */
  decidedBy: 'gate' | 'human' | 'claude',
  decisionId?: string,
  /**
   * 남길 쪽. 안 정했으면 생략.
   *
   * 저장하는 이유는 판정 근거(관계 수·판 경로)가 시간이 지나면 변해서다.
   * "나중에 다시 계산"은 같은 답을 주지 않는다.
   */
  canonicalId?: string,
): Promise<void> {
  if (a === b) return
  const [lo, hi] = a < b ? [a, b] : [b, a]
  const db = await getDb()
  await db.query(
    `insert into qnode_equivalence (node_a, node_b, decided_by, decision_id, canonical_id)
     values ($1, $2, $3, $4, $5)
     on conflict (node_a, node_b) do nothing`,
    [lo, hi, decidedBy, decisionId ?? null, canonicalId ?? null],
  )
}

export async function recordEvent(args: {
  parentNodeId: string | null
  rawInput: string
  verdict: 'accepted' | 'rejected' | 'error'
  rejectReason?: string
  resultingNodeId?: string
  candidateIds?: string[]
  matchedNodeId?: string
  /** 매칭이 어떻게 이뤄졌나. 'gate'|'hash'|'suggestion'|'lease'|'ancestor'. 매칭이 아니면 생략 */
  matchedVia?: string
  gateVersion?: string
}): Promise<string> {
  const db = await getDb()
  const rows = await db.query<{ id: string }>(
    `insert into expansion_event
       (parent_qnode_id, raw_input, verdict, reject_reason, resulting_qnode_id,
        candidate_ids, matched_node_id, gate_version, matched_via)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [
      args.parentNodeId,
      args.rawInput,
      args.verdict,
      args.rejectReason ?? null,
      args.resultingNodeId ?? null,
      args.candidateIds ?? null,
      args.matchedNodeId ?? null,
      args.gateVersion ?? null,
      args.matchedVia ?? null,
    ],
  )
  return rows[0].id
}
