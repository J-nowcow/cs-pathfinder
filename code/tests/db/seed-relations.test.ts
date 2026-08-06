import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { seedRelations } from '@/lib/db/bootstrap'
import { loadRelations } from '@/lib/db/relations'
import type { SeedRelation } from '../../data/relations'

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
