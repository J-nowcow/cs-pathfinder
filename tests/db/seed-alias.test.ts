import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { seedExampleNodes, rootNodeId } from '@/lib/db/bootstrap'
import { questionHash } from '@/lib/expand/hash'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'
import { isIdentityScope } from '@/lib/expand/scopes'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'

/**
 * 시드 노드의 별칭.
 *
 * 같은 질문을 다시 물으면 새로 만들지 않는다는 것이 이 서비스의 비용 급소인데,
 * 그 판단이 `qnode_alias`의 (정규화 버전, 해시) 조회 하나로 이뤄진다.
 *
 * 해시는 **스코프를 포함한다.** 그런데 게이트는 목록 밖 스코프를 `generic`으로
 * 강제하고 시드는 원래 값 그대로 별칭을 달았다. 시드 249개 중 53개(21%)가
 * 목록 밖이라 그만큼이 영영 캐시를 못 탔다.
 */
async function aliasIdOf(hash: string): Promise<string | null> {
  const db = await getDb()
  const rows = await db.query<{ qnode_id: string }>(
    `select qnode_id from qnode_alias where normalizer_version = $1 and normalized_hash = $2`,
    [NORMALIZER_VERSION, hash],
  )
  return rows[0]?.qnode_id ?? null
}

describe('seedExampleNodes 별칭', () => {
  beforeEach(truncateAll)

  /*
   * 게이트가 만들 해시로 찾을 수 있어야 한다.
   *
   * 게이트는 `distributed`를 못 알아보고 `generic`을 내놓는다. 시드가 그 자리를
   * 안 채워두면 사용자가 똑같은 질문을 입력해도 새 노드가 생긴다.
   */
  it('registers the alias the gate will actually look up', async () => {
    await seedExampleNodes()

    const out = GENERATED_NODES.find((n) => !isIdentityScope(n.identityScope))
    expect(out, '스키마 밖 스코프를 쓰는 시드가 있어야 이 시험이 의미가 있다').toBeDefined()

    const gateHash = questionHash('generic', out!.question)
    expect(await aliasIdOf(gateHash)).toBe(rootNodeId(out!))
  })

  /* 원래 스코프로도 찾을 수 있어야 한다. 두 벌을 다는 것이지 옮기는 것이 아니다 */
  it('keeps the alias for the declared scope', async () => {
    await seedExampleNodes()

    const out = GENERATED_NODES.find((n) => !isIdentityScope(n.identityScope))!
    expect(await aliasIdOf(questionHash(out.identityScope, out.question))).toBe(rootNodeId(out))
  })

  /* 목록 안 스코프에는 한 벌만 단다. 쓸데없는 행을 249개 더 만들 이유가 없다 */
  it('adds only one alias when the scope is already valid', async () => {
    await seedExampleNodes()

    const ok = GENERATED_NODES.find((n) => isIdentityScope(n.identityScope) && n.identityScope !== 'generic')!
    expect(await aliasIdOf(questionHash(ok.identityScope, ok.question))).toBe(rootNodeId(ok))
    // generic 자리는 비어 있거나 다른 노드의 것이다 — 이 노드가 채우지 않았다
    expect(await aliasIdOf(questionHash('generic', ok.question))).not.toBe(rootNodeId(ok))
  })

  /*
   * 시드 전체가 게이트 해시로 닿아야 한다.
   *
   * 위 세 시험은 표본 하나씩이다. 이건 249개를 전부 훑는다 — 나중에 스코프가
   * 새로 늘어도 여기서 잡힌다.
   */
  it('makes every seeded question reachable by its gate hash', async () => {
    await seedExampleNodes()

    const unreachable: string[] = []
    for (const n of [...EXAMPLE_NODES, ...GENERATED_NODES]) {
      const scope = isIdentityScope(n.identityScope) ? n.identityScope : 'generic'
      const found = await aliasIdOf(questionHash(scope, n.question))
      // 같은 질문이 두 스코프에 있으면 먼저 심은 쪽이 별칭을 갖는다.
      // 닿기만 하면 되므로 어느 노드인지는 따지지 않는다
      if (!found) unreachable.push(`${n.identityScope}::${n.question}`)
    }
    expect(unreachable).toEqual([])
  })
})
