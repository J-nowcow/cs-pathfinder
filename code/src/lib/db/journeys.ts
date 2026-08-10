import { getDb } from '@/lib/db/client'
import { pathKeyOf } from '@/lib/journey/merge'
import type { JourneyState, Occurrence } from '@/lib/journey/types'

/**
 * 여정의 서버 쪽 절반 (C4).
 *
 * 클라이언트는 구조(id·nodeId·parentId)만 보낸다. 문장(question·category)은
 * 여기서 qnode를 join해 다시 읽는다 — 클라이언트가 보낸 문장을 저장하면
 * 남의 화면에 임의 텍스트를 띄우는 통로가 된다 (share 라우트와 같은 결정).
 *
 * 병합의 정체성은 pathKey이고 **서버가 직접 계산한다.** 클라이언트가
 * 계산해 보내게 하면 조작된 키 하나로 남의 경로 자리를 차지할 수 있다.
 */

/** 클라이언트가 보내는 발자국 — 구조뿐이다 */
export type SubmittedOccurrence = {
  id: string
  nodeId: string
  parentId: string | null
}

export type JourneySnapshot = {
  occurrences: Occurrence[]
  currentId: string | null
}

export type MergeOutcome =
  | { kind: 'ok'; journey: JourneySnapshot }
  | { kind: 'invalid_forest'; reason: string }
  | { kind: 'unknown_node' }

/**
 * 더하기 병합. 치환 경로는 없다.
 *
 * 같은 forest 재전송(응답 유실 후 재시도)은 unique (user_id, path_key)와
 * on conflict do nothing이 받아낸다 — 행이 늘지 않는다.
 */
export async function mergeJourneyForUser(
  userId: string,
  occurrences: SubmittedOccurrence[],
  currentId: string | null,
): Promise<MergeOutcome> {
  // 1. 구조 검증 — DB에 닿기 전에 끝낸다
  const ids = new Set<string>()
  for (const o of occurrences) {
    if (ids.has(o.id)) return { kind: 'invalid_forest', reason: `중복 id: ${o.id}` }
    ids.add(o.id)
  }
  for (const o of occurrences) {
    if (o.parentId !== null && !ids.has(o.parentId)) {
      return { kind: 'invalid_forest', reason: `없는 부모: ${o.parentId}` }
    }
  }

  /*
   * 2. pathKey를 서버가 계산한다. 제출 구조를 JourneyState로 재구성해
   * 클라이언트와 같은 함수(pathKeyOf)를 쓴다 — 정의가 두 벌이면 언젠가
   * 어긋난다. 문장은 키에 안 들어가므로 빈 값으로 채운다.
   */
  const submittedState: JourneyState = {
    occurrences: occurrences.map((o) => ({ ...o, question: '', category: '' })),
    currentId: null,
  }
  const keyOf = new Map<string, string>() // 제출 id -> pathKey
  for (const o of occurrences) {
    const key = pathKeyOf(submittedState, o.id)
    // 순환이 있으면 pathTo가 사슬을 끊어 뿌리 없는 키가 나온다 — 자기 nodeId로 안 끝나면 손상
    if (!key.endsWith(o.nodeId)) return { kind: 'invalid_forest', reason: `순환 경로: ${o.id}` }
    keyOf.set(o.id, key)
  }

  const db = await getDb()

  // 3. 노드 실재 검증 — FK 오류(500)를 400으로 앞당긴다
  if (occurrences.length > 0) {
    const nodeIds = [...new Set(occurrences.map((o) => o.nodeId))]
    const found = await db.query<{ id: string }>(
      `select id from qnode where id = any($1::uuid[])`,
      [nodeIds],
    )
    if (found.length !== nodeIds.length) return { kind: 'unknown_node' }
  }

  await db.transaction(async (tx) => {
    // 얕은 것부터 — 부모 키가 항상 먼저 서버 id를 얻는다
    const sorted = [...occurrences].sort(
      (a, b) => keyOf.get(a.id)!.split('>').length - keyOf.get(b.id)!.split('>').length,
    )

    const existing = await tx.query<{ id: string; path_key: string }>(
      `select id, path_key from journey_occurrence where user_id = $1`,
      [userId],
    )
    const serverIdByKey = new Map(existing.map((r) => [r.path_key, r.id]))

    const maxRow = await tx.query<{ m: number }>(
      `select coalesce(max(position), 0)::int m from journey_occurrence where user_id = $1`,
      [userId],
    )
    let pos = maxRow[0].m

    for (const o of sorted) {
      const key = keyOf.get(o.id)!
      if (serverIdByKey.has(key)) continue

      const parentKey = key.includes('>') ? key.slice(0, key.lastIndexOf('>')) : null
      const parentServerId = parentKey === null ? null : (serverIdByKey.get(parentKey) ?? null)

      pos += 1
      const inserted = await tx.query<{ id: string }>(
        `insert into journey_occurrence (user_id, qnode_id, parent_occurrence_id, position, path_key)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id, path_key) do nothing
         returning id`,
        [userId, o.nodeId, parentServerId, pos, key],
      )
      if (inserted.length > 0) {
        serverIdByKey.set(key, inserted[0].id)
      } else {
        // 동시 탭이 먼저 넣었다 — 그 행을 받아 간다
        const raced = await tx.query<{ id: string }>(
          `select id from journey_occurrence where user_id = $1 and path_key = $2`,
          [userId, key],
        )
        if (raced.length > 0) serverIdByKey.set(key, raced[0].id)
      }
    }

    // 커서 — 제출 currentId의 경로에 해당하는 서버 행으로
    if (currentId && keyOf.has(currentId)) {
      const serverId = serverIdByKey.get(keyOf.get(currentId)!)
      if (serverId) {
        await tx.query(
          `insert into journey_cursor (user_id, occurrence_id, updated_at)
           values ($1, $2, now())
           on conflict (user_id) do update set occurrence_id = excluded.occurrence_id, updated_at = now()`,
          [userId, serverId],
        )
      }
    }
  })

  return { kind: 'ok', journey: await loadJourneyForUser(userId) }
}

/** 전체 여정 + 커서. 문장은 qnode에서 — 여정은 이력이라 등가 접기를 안 건다. */
export async function loadJourneyForUser(userId: string): Promise<JourneySnapshot> {
  const db = await getDb()
  const rows = await db.query<{
    id: string
    qnode_id: string
    parent_occurrence_id: string | null
    question: string
    category: string
  }>(
    `select o.id, o.qnode_id, o.parent_occurrence_id,
            q.normalized_question as question, q.primary_category as category
       from journey_occurrence o
       join qnode q on q.id = o.qnode_id
      where o.user_id = $1
      order by o.position`,
    [userId],
  )
  const cursor = await db.query<{ occurrence_id: string }>(
    `select occurrence_id from journey_cursor where user_id = $1`,
    [userId],
  )
  return {
    occurrences: rows.map((r) => ({
      id: r.id,
      nodeId: r.qnode_id,
      parentId: r.parent_occurrence_id,
      question: r.question,
      category: r.category,
    })),
    currentId: cursor[0]?.occurrence_id ?? null,
  }
}
