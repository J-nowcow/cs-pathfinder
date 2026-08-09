import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'
import { NODE_TAGS } from '../../data/node-tags'
import { TAG_NAMES } from '../../data/tags'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'

/**
 * **태그의 세 가지 약속.**
 *
 * ① 통제 어휘 — `tags.ts` 밖의 태그는 못 단다. 자유 태그는
 *    `동시성`/`concurrency` 분열을 만들고, 분열된 태그는 없는 것과 같다.
 * ② 질문 키가 실재 — 매핑의 질문이 데이터 파일에 없으면 그 태그는
 *    영영 안 붙는다. 제목 바꾸기(renames)가 이걸 조용히 끊는다.
 * ③ 시드가 갱신 — 파일에서 태그를 고치면 기존 행에 반영돼야 한다.
 *    B5에서 분야가 정확히 이걸 안 해서 "고쳤는데 안 바뀌는" 상태였다.
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

describe('태그 데이터', () => {
  it('태그가 실제로 있다', () => {
    expect(NODE_TAGS.length).toBeGreaterThan(0)
  })

  /** ① 통제 어휘 밖의 태그는 시험이 막는다 */
  it('모든 태그가 통제 어휘 안에 있다', () => {
    const outlaws = NODE_TAGS.flatMap((n) =>
      n.tags.filter((t) => !TAG_NAMES.has(t)).map((t) => `${t} (${n.question.slice(0, 20)}…)`),
    )
    expect(outlaws).toEqual([])
  })

  /** ② 매핑의 질문이 데이터 파일에 글자 그대로 있어야 한다 */
  it('매핑의 질문이 데이터 파일에 실재한다', () => {
    const missing = NODE_TAGS.filter((n) => !ALL_QUESTIONS.has(n.question.trim())).map(
      (n) => n.question,
    )
    expect(missing).toEqual([])
  })

  it('빈 태그 배열은 두지 않는다 — 무태그면 항목을 빼라', () => {
    expect(NODE_TAGS.filter((n) => n.tags.length === 0)).toEqual([])
  })
})

describe('태그 시드', () => {
  it('시드가 태그를 심는다', async () => {
    await ensureSeeded()
    const db = await getDb()
    const sample = NODE_TAGS[0]
    const rows = await db.query<{ tags: string[] }>(
      `select tags from qnode where normalized_question = $1`,
      [sample.question],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].tags).toEqual(sample.tags)
  })

  /** ③ B5의 분야 미갱신과 같은 구멍을 태그에서 막는다 */
  it('태그가 바뀌면 기존 행을 갱신한다', async () => {
    const db = await getDb()
    const sample = NODE_TAGS[0]
    const node = [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES].find(
      (n) => n.question.trim() === sample.question.trim(),
    )!

    await db.query(
      `insert into qnode (id, identity_scope, normalized_question, body, primary_category, status, origin, number, tags)
       values ('11111111-2222-3333-4444-777777777777', $1, $2, $3, $4, 'ready', 'batch', 9003, '{옛태그}')`,
      [node.identityScope, node.question, node.body, node.category],
    )

    await ensureSeeded()

    const rows = await db.query<{ tags: string[] }>(
      `select tags from qnode where normalized_question = $1`,
      [sample.question],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].tags).toEqual(sample.tags)
  })
})
