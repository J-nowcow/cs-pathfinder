import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'
import { NODE_LEVELS } from '../../data/node-levels'
import { LEVEL_NAMES } from '../../data/levels'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'

/**
 * 난이도의 약속 — 태그(`node-tags.test.ts`)와 같은 세 가지다.
 * ① rubric의 3단 밖의 값 금지 ② 질문 키 실재 ③ 시드가 심고 갱신한다.
 */
beforeEach(async () => {
  await resetDb()
  resetSeedCache()
})

const ALL_QUESTIONS = new Set(
  [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES].map((n) =>
    n.question.trim(),
  ),
)

describe('난이도 데이터', () => {
  it('판정이 실제로 있다', () => {
    expect(NODE_LEVELS.length).toBeGreaterThan(300)
  })

  it('모든 값이 3단 안에 있다', () => {
    const outlaws = NODE_LEVELS.filter((n) => !LEVEL_NAMES.has(n.level))
    expect(outlaws).toEqual([])
  })

  it('매핑의 질문이 데이터 파일에 실재한다', () => {
    const missing = NODE_LEVELS.filter((n) => !ALL_QUESTIONS.has(n.question.trim())).map(
      (n) => n.question,
    )
    expect(missing).toEqual([])
  })

  /**
   * 분포가 극단으로 쏠리면 rubric이 일을 안 한 것이다. 1차 판정은
   * 기초 164 · 심화 144 · 깊이 14였다 — 어느 급도 전체의 4% 아래로
   * 내려가면 그 급은 사실상 없는 것이니 다시 본다.
   */
  it('세 급이 전부 쓰인다', () => {
    const dist = new Map<string, number>()
    for (const n of NODE_LEVELS) dist.set(n.level, (dist.get(n.level) ?? 0) + 1)
    expect(dist.size).toBe(3)
    for (const [, c] of dist) expect(c).toBeGreaterThan(NODE_LEVELS.length * 0.02)
  })
})

describe('난이도 시드', () => {
  it('시드가 심고, 파일이 바뀌면 갱신한다', async () => {
    const db = await getDb()
    const sample = NODE_LEVELS[0]
    const node = [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES].find(
      (n) => n.question.trim() === sample.question.trim(),
    )!

    /* 옛 판정이 저장된 행을 흉내 낸다 — 갱신이 되는지가 관건이다 */
    await db.query(
      `insert into qnode (id, identity_scope, normalized_question, body, primary_category, status, origin, number, level)
       values ('11111111-2222-3333-4444-888888888888', $1, $2, $3, $4, 'ready', 'batch', 9004, '옛급')`,
      [node.identityScope, node.question, node.body, node.category],
    )

    await ensureSeeded()

    const rows = await db.query<{ level: string | null }>(
      `select level from qnode where normalized_question = $1`,
      [sample.question],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].level).toBe(sample.level)
  })
})
