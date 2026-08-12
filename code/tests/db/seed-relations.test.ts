import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { seedRelations } from '@/lib/db/bootstrap'
import { loadRelations } from '@/lib/db/relations'
import type { SeedRelation } from '../../data/relations'
import { SEED_RELATIONS } from '../../data/relations'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'

/**
 * 데이터 파일의 관계를 DB에 심는다.
 *
 * 관계는 (범위, 질문) 쌍으로 적혀 있고 심을 때 DB에서 찾는다. 질문 문장을 고치면
 * 가리키던 자리가 사라지는데, 그때 조용히 넘어가면 선이 사라진 것을 아무도 모른다.
 */
async function node(scope: string, question: string) {
  return insertNode({
    identityScope: scope,
    normalizedQuestion: question,
    body: `${question} 해설`,
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'batch',
  })
}

const rel = (from: string, to: string): SeedRelation => ({
  fromScope: 'generic',
  fromQuestion: from,
  toScope: 'generic',
  toQuestion: to,
  kind: 'shares_concept',
  reason: '같은 개념이다',
  votes: 2,
})

describe('seedRelations', () => {
  beforeEach(truncateAll)

  it('links the two questions', async () => {
    const a = await node('generic', 'TCP는 무엇을 보장하는가?')
    const b = await node('generic', '3-way handshake는 왜 세 번인가?')

    const out = await seedRelations([rel('TCP는 무엇을 보장하는가?', '3-way handshake는 왜 세 번인가?')])

    expect(out).toMatchObject({ inserted: 1, missing: 0 })
    const [r] = await loadRelations()
    expect(r).toMatchObject({ fromId: a, toId: b, votes: 2 })
  })

  /* 두 번 심어도 한 줄이다. 부팅마다 도는 코드다 */
  it('is idempotent', async () => {
    await node('generic', 'TCP는 무엇을 보장하는가?')
    await node('generic', '3-way handshake는 왜 세 번인가?')
    const rows = [rel('TCP는 무엇을 보장하는가?', '3-way handshake는 왜 세 번인가?')]

    await seedRelations(rows)
    await seedRelations(rows)

    expect(await loadRelations()).toHaveLength(1)
  })

  /*
   * 한쪽이 없으면 세어서 알린다. 질문 문장을 고치면 여기가 어긋나는데,
   * 조용히 넘어가면 선이 사라진 것을 아무도 모른다.
   */
  it('counts relations whose node is gone', async () => {
    await node('generic', 'TCP는 무엇을 보장하는가?')

    const out = await seedRelations([rel('TCP는 무엇을 보장하는가?', '사라진 질문은?')])

    expect(out).toMatchObject({ inserted: 0, missing: 1 })
    expect(await loadRelations()).toHaveLength(0)
  })

  it('handles an empty list', async () => {
    expect(await seedRelations([])).toMatchObject({ inserted: 0, missing: 0 })
  })
})

describe('관계 데이터', () => {
  it('모든 관계가 정적 질문을 가리킨다', () => {
    const nodes = [...EXAMPLE_NODES, ...GENERATED_NODES, ...AUTHORED_NODES, ...ON_DEMAND_NODES]
    const keys = new Set(nodes.map((item) => `${item.identityScope}::${item.question}`))
    const missing = SEED_RELATIONS.filter(
      (item) =>
        !keys.has(`${item.fromScope}::${item.fromQuestion}`) ||
        !keys.has(`${item.toScope}::${item.toQuestion}`),
    )

    expect(missing).toEqual([])
  })

  it('관계 생성기가 사라진 질문을 다시 이어받지 않는다', () => {
    const source = readFileSync('scripts/build-relations.ts', 'utf8')
    expect(source).toContain('existing.has(`${row.fromScope}::${row.fromQuestion}`)')
    expect(source).toContain('existing.has(`${row.toScope}::${row.toQuestion}`)')
  })
})
