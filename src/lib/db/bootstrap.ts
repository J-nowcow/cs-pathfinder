import { getDb } from '@/lib/db/client'
import { derivedUuid } from '@/lib/db/uuid'
import { questionHash } from '@/lib/expand/hash'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'
import { EXAMPLE_NODES, type ExampleNode } from '../../../data/example-nodes'
import { GENERATED_NODES } from '../../../data/generated-nodes'
import { SEED_RELATIONS, type SeedRelation } from '../../../data/relations'
import { saveRelations, type NewRelation } from '@/lib/db/relations'

export function rootNodeId(node: Pick<ExampleNode, 'identityScope' | 'question'>): string {
  return derivedUuid(`node:${node.identityScope}:${node.question}`)
}

function suggestionId(nodeId: string, position: number): string {
  return derivedUuid(`sug:${nodeId}:${position}`)
}

/**
 * 예시 루트를 삽입한다. 멱등이다.
 *
 * 계획 3의 매일 발행이 붙기 전까지 홈에 보여줄 콘텐츠이자 확장의 출발점이다.
 *
 * **본문은 갱신하고 추천은 건드리지 않는다.** 둘의 성격이 다르다.
 * 본문은 이 파일이 단일 출처인 저작 콘텐츠라 고치면 화면에 반영돼야 한다.
 * 실제로 도식을 넣었을 때 이미 시드된 노드가 옛 글을 계속 보여줬다.
 * 추천은 파생 ID를 갖고 사용자가 판 노드와 이어져 있어서, 덮으면 그 연결이
 * 가리키던 자리가 어긋난다.
 *
 * 내용이 같으면 아무것도 쓰지 않는다. 부팅마다 도는 코드라 매번 쓰면
 * 콜드 스타트에 쓸모없는 왕복이 붙는다.
 */
export async function seedExampleNodes(): Promise<{ inserted: number; refreshed: number }> {
  const db = await getDb()
  let inserted = 0
  let refreshed = 0

  /*
   * 손으로 쓴 것과 생성된 것을 함께 심는다.
   *
   * 파일은 나눠 둔다 — example-nodes.ts는 생성 규칙의 기준선이고 시험이 그것을
   * 상대로 걸려 있다. 심을 때는 둘 다 화면에 나가는 콘텐츠라 차이가 없다.
   *
   * 손으로 쓴 것을 먼저 심는다. 같은 질문이 양쪽에 있으면 손으로 쓴 쪽이
   * 남아야 한다.
   */
  for (const ex of [...EXAMPLE_NODES, ...GENERATED_NODES]) {
    const id = rootNodeId(ex)

    // xmax = 0 이면 방금 넣은 행이다. 갱신된 행과 구별하는 표준 수법이다.
    const rows = await db.query<{ id: string; created: boolean }>(
      `insert into qnode
         (id, identity_scope, normalized_question, body, primary_category, status, origin)
       values ($1, $2, $3, $4, $5, 'ready', 'batch')
       on conflict (id) do update set body = excluded.body
         where qnode.body is distinct from excluded.body
       returning id, (xmax = 0) as created`,
      [id, ex.identityScope, ex.question, ex.body, ex.category],
    )

    if (rows.length === 0) continue

    if (!rows[0].created) {
      refreshed += 1
      continue
    }

    inserted += 1

    for (const [position, text] of ex.suggestions.entries()) {
      await db.query(
        `insert into qnode_suggestion (id, qnode_id, text, position, target_node_id)
         values ($1, $2, $3, $4, null)
         on conflict (qnode_id, position) do nothing`,
        [suggestionId(id, position), id, text, position],
      )
    }

    // alias가 있어야 같은 질문이 자유 입력으로 들어왔을 때 캐시에 걸린다.
    await db.query(
      `insert into qnode_alias (normalizer_version, normalized_hash, qnode_id)
       values ($1, $2, $3)
       on conflict (normalizer_version, normalized_hash) do nothing`,
      [NORMALIZER_VERSION, questionHash(ex.identityScope, ex.question), id],
    )
  }

  return { inserted, refreshed }
}

/**
 * 의미 관계를 심는다. 멱등이다.
 *
 * 관계는 (범위, 질문) 쌍으로 적혀 있다. 파생 id로 바로 계산하지 않고 DB에서
 * 찾는다. 파생 규칙을 두 곳에 두면 한쪽만 바뀌었을 때 선이 조용히 사라진다.
 * 찾는 비용은 부팅당 한 번의 질의다.
 *
 * **못 찾은 것을 세어 돌려준다.** 질문 문장을 고치면 여기가 어긋나는데, 조용히
 * 넘어가면 선이 사라진 것을 아무도 모른다. 세어 두면 부를 쪽에서 알아챌 수 있다.
 */
export async function seedRelations(rels: SeedRelation[]): Promise<{ inserted: number; missing: number }> {
  if (rels.length === 0) return { inserted: 0, missing: 0 }

  const db = await getDb()

  // 한 번에 다 찾는다. 관계마다 질의를 날리면 249개에 수백 번이다
  const wanted = new Set(rels.flatMap((r) => [`${r.fromScope}::${r.fromQuestion}`, `${r.toScope}::${r.toQuestion}`]))
  const rows = await db.query<{ id: string; scope: string; question: string }>(
    `select id, identity_scope as scope, normalized_question as question from qnode`,
  )
  const idOf = new Map<string, string>()
  for (const r of rows) {
    const key = `${r.scope}::${r.question}`
    if (wanted.has(key)) idOf.set(key, r.id)
  }

  const ready: NewRelation[] = []
  let missing = 0
  for (const r of rels) {
    const from = idOf.get(`${r.fromScope}::${r.fromQuestion}`)
    const to = idOf.get(`${r.toScope}::${r.toQuestion}`)
    if (!from || !to) {
      missing += 1
      continue
    }
    ready.push({ fromId: from, toId: to, kind: r.kind, source: 'llm', reason: r.reason, votes: r.votes })
  }

  await saveRelations(ready)
  return { inserted: ready.length, missing }
}

let seeding: Promise<void> | null = null

/**
 * 앱 진입점에서 부른다. 프로세스당 1회만 돈다.
 *
 * 불리언 플래그를 쓰면 첫 호출이 끝나기 전에 도착한 두 번째 요청이 그대로 통과한다.
 * promise를 캐싱해야 동시 요청이 같은 작업을 기다린다.
 */
export function ensureSeeded(): Promise<void> {
  if (!seeding) {
    // 질문을 먼저 심는다. 관계는 질문을 찾아 잇는 것이라 순서가 뒤집히면 전부 못 찾는다
    seeding = seedExampleNodes()
      .then(() => seedRelations(SEED_RELATIONS))
      .then(({ missing }) => {
        // 질문 문장을 고치면 여기가 어긋난다. 화면은 멀쩡해 보이고 선만 사라진다
        if (missing > 0) console.warn(`[seed] 관계 ${missing}개가 가리키는 질문을 못 찾았다`)
      })
      .catch((e) => {
        // 실패를 캐싱하면 다음 요청이 영영 빈 화면을 본다.
        seeding = null
        throw e
      })
  }
  return seeding
}

/** 테스트 격리용. truncate 후 시드를 다시 돌릴 수 있게 한다. */
export function resetSeedCache(): void {
  seeding = null
}
