import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode, linkEquivalent } from '@/lib/expand/nodes'

/**
 * **등가 쌍의 "남길 쪽"이 저장되는가.**
 *
 * B6 중복 정리의 판정 근거(관계 수·판 경로)는 시간이 지나면 변한다.
 * canonical을 저장하지 않으면 "나중에 다시 계산"이 다른 답을 준다 --
 * 2026-08-07 전수 대조의 잉여 31편 목록이 저장 안 돼서 이번에 통째로
 * 다시 만들었다. 같은 실수를 표 차원에서 막는다.
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

describe('linkEquivalent canonical', () => {
  it('남길 쪽이 저장된다', async () => {
    const keep = await mk('정본?')
    const fold = await mk('접힘?')
    await linkEquivalent(fold, keep, 'claude', undefined, keep)

    const db = await getDb()
    const rows = await db.query<{ canonical_id: string | null; decided_by: string }>(
      `select canonical_id, decided_by from qnode_equivalence`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].canonical_id).toBe(keep)
    expect(rows[0].decided_by).toBe('claude')
  })

  /** 정본을 안 정한 등가(게이트 등)도 유효해야 한다 */
  it('canonical 없이도 기록된다', async () => {
    const a = await mk('하나?')
    const b = await mk('둘?')
    await linkEquivalent(a, b, 'gate')

    const db = await getDb()
    const rows = await db.query<{ canonical_id: string | null }>(
      `select canonical_id from qnode_equivalence`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].canonical_id).toBeNull()
  })

  /**
   * (a,b)와 (b,a)가 두 행이 되면 안 된다는 기존 계약이 canonical을
   * 넣어도 유지되는가. 정렬은 노드 쌍에만 걸리고 canonical은 어느 쪽이든
   * 가리킬 수 있어야 한다.
   */
  it('역순으로 넣어도 한 행이고 canonical은 그대로다', async () => {
    const keep = await mk('정본?')
    const fold = await mk('접힘?')
    await linkEquivalent(keep, fold, 'claude', undefined, keep)
    await linkEquivalent(fold, keep, 'claude', undefined, fold)

    const db = await getDb()
    const rows = await db.query<{ canonical_id: string }>(
      `select canonical_id from qnode_equivalence`,
    )
    expect(rows).toHaveLength(1)
    /* 먼저 기록한 판정이 임자다 -- on conflict do nothing */
    expect(rows[0].canonical_id).toBe(keep)
  })
})
