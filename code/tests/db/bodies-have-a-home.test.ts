import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { PENDING_NODES } from '../../data/pending-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'

/**
 * 모든 글에 **고칠 파일이 있는가.**
 *
 * 사실 검증 교정 13건이 전부 "정적 파일에서 못 찾음"으로 떨어졌다. 도구가
 * 고장 난 것이 아니라 그 글들이 DB에만 살았다. 26편이 그랬다.
 *
 * DB에만 있으면 이렇게 된다.
 *
 * - 고칠 곳이 없다. `cs/explanations/`의 마크다운은 DB를 떠 놓은 사본이라
 *   거기서 고쳐도 다음 덤프에 덮인다.
 * - **남이 오탈자 하나 고쳐 보낼 파일이 없다.** 오픈소스를 내걸고 글의 일부를
 *   버전 관리 밖에 두는 셈이다.
 * - 사고가 나면 그 26편만 복구할 근거가 없다.
 *
 * 사용자가 물어보면 노드는 계속 생긴다. 그래서 한 번 꺼내는 것으로는 안 되고
 * **다시 새는지 시험이 지켜야 한다.**
 */
beforeEach(async () => {
  await resetDb()
  /* 약속이 캐싱된다. 안 비우면 새 DB에 아무것도 안 심겨 0과 0을 견준다 */
  resetSeedCache()
})

describe('본문은 파일에 산다', () => {
  it('DB에 실린 글은 모두 정적 파일에 짝이 있다', async () => {
    await ensureSeeded()
    const db = await getDb()
    const rows = await db.query<{ q: string }>(
      `select normalized_question q
         from qnode
        where status = 'ready' and body is not null and body <> ''`,
    )
    /* 먼저 정말 심겼는지 본다. 0편이면 무엇을 지워도 통과한다 */
    expect(rows.length).toBeGreaterThan(20)

    const inFile = new Set(
      [
        ...EXAMPLE_NODES,
        ...AUTHORED_NODES,
        ...GENERATED_NODES,
        ...PENDING_NODES,
        ...ON_DEMAND_NODES,
      ].map((n) => n.question.trim()),
    )
    const orphans = rows.map((r) => r.q.trim()).filter((q) => !inFile.has(q))
    expect(orphans).toEqual([])
  })

  /*
   * 위 시험만 두면 `bootstrap`이 `ON_DEMAND_NODES`를 안 읽어도 통과한다.
   * DB에 안 심기면 짝을 찾을 일도 없기 때문이다. 그래서 **심겼는지**를 따로
   * 건다 -- 부팅 시드에서 그 배열을 빼면 여기서 걸린다.
   */
  it('부팅 시드가 on-demand 글을 실제로 심는다', async () => {
    await ensureSeeded()
    const db = await getDb()
    const sample = ON_DEMAND_NODES.slice(0, 5).map((n) => n.question.trim())
    expect(sample.length).toBe(5)

    const rows = await db.query<{ q: string }>(
      `select normalized_question q from qnode where normalized_question = any($1)`,
      [sample],
    )
    expect(rows.map((r) => r.q.trim()).sort()).toEqual([...sample].sort())
  })
})
