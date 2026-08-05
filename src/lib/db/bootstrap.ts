import { getDb } from '@/lib/db/client'
import { derivedUuid } from '@/lib/db/uuid'
import { questionHash } from '@/lib/expand/hash'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'
import { EXAMPLE_NODES, type ExampleNode } from '../../../data/example-nodes'

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
 * 이미 있으면 건드리지 않는다. 부팅마다 도는 코드라 덮어쓰면 사용자가 파던
 * 노드의 추천 ID가 갈아엎어진다.
 */
export async function seedExampleNodes(): Promise<{ inserted: number }> {
  const db = await getDb()
  let inserted = 0

  for (const ex of EXAMPLE_NODES) {
    const id = rootNodeId(ex)

    const rows = await db.query<{ id: string }>(
      `insert into qnode
         (id, identity_scope, normalized_question, body, primary_category, status, origin)
       values ($1, $2, $3, $4, $5, 'ready', 'batch')
       on conflict (id) do nothing
       returning id`,
      [id, ex.identityScope, ex.question, ex.body, ex.category],
    )

    if (rows.length === 0) continue
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

  return { inserted }
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
    seeding = seedExampleNodes()
      .then(() => undefined)
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
