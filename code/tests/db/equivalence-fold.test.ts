import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode, linkEquivalent } from '@/lib/expand/nodes'
import { listRoots } from '@/lib/db/roots'
import { loadMapData } from '@/lib/db/graph'

/**
 * **등가로 접힌 잉여가 화면에서 사라지는가 — 그리고 주소는 사는가.**
 *
 * 같은 질문이 목록에 두 번 뜨는 것이 중복의 체감이었다. B6가 20쌍을
 * 등가로 기록했고, 여기 시험은 그 기록이 실제로 화면을 바꾸는 것과
 * **바꾸지 말아야 할 곳(주소)은 안 바꾸는 것**을 함께 지킨다.
 *
 * `NOT_FOLDED_SQL` 조각을 목록·지도 어느 한쪽에서 지우면 깨진다.
 */
beforeEach(truncateAll)

const mk = (q: string) =>
  insertNode({
    identityScope: 'generic',
    normalizedQuestion: q,
    body: '본문',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'batch',
  })

describe('등가 접기', () => {
  it('잉여는 목록에서 접히고 정본은 남는다', async () => {
    const keep = await mk('정본 질문?')
    const fold = await mk('잉여 질문?')
    await linkEquivalent(fold, keep, 'claude', undefined, keep)

    const roots = await listRoots()
    const questions = roots.map((r) => r.question)
    expect(questions).toContain('정본 질문?')
    expect(questions).not.toContain('잉여 질문?')
  })

  it('지도에서도 같은 기준으로 접힌다', async () => {
    const keep = await mk('정본 질문?')
    const fold = await mk('잉여 질문?')
    await linkEquivalent(fold, keep, 'claude', undefined, keep)

    const map = await loadMapData()
    const ids = map.nodes.map((n) => n.id)
    expect(ids).toContain(keep)
    expect(ids).not.toContain(fold)
  })

  /** 정본을 안 정한 등가(게이트가 만든 것)는 아무도 안 접는다 */
  it('canonical이 없는 등가는 접지 않는다', async () => {
    const a = await mk('하나?')
    const b = await mk('둘?')
    await linkEquivalent(a, b, 'gate')

    const roots = await listRoots()
    expect(roots).toHaveLength(2)
  })

  /** 내린(active=false) 등가는 되돌아온다 — 표의 설계 그대로 */
  it('등가를 내리면 잉여가 목록에 돌아온다', async () => {
    const keep = await mk('정본 질문?')
    const fold = await mk('잉여 질문?')
    await linkEquivalent(fold, keep, 'claude', undefined, keep)

    const db = await getDb()
    await db.query(`update qnode_equivalence set active = false`)

    const roots = await listRoots()
    expect(roots).toHaveLength(2)
  })

  /**
   * **주소는 접지 않는다.** 옛 링크(`/q/잉여`)가 죽으면 정리가 아니라
   * 파손이다. loadNode 경로가 이 필터를 안 쓰는 것을 고정한다.
   */
  it('잉여의 주소는 계속 산다', async () => {
    const { loadNode } = await import('@/lib/expand/cache')
    const keep = await mk('정본 질문?')
    const fold = await mk('잉여 질문?')
    await linkEquivalent(fold, keep, 'claude', undefined, keep)

    const node = await loadNode(fold)
    expect(node?.question).toBe('잉여 질문?')
  })
})
