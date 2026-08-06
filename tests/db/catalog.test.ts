import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { loadCatalog, renderCatalog } from '@/lib/db/catalog'

/**
 * 레포에 올릴 질문 목록.
 *
 * 두 가지가 걸리면 안 된다. 사용자가 판 질문이 레포에 박히는 것(되돌릴 수 없다)과,
 * 아직 오지 않은 발행분이 새는 것(화면에서 감춰 놓고 레포에 적으면 감춘 의미가 없다).
 */
const TODAY = '2026-08-06'

async function node(question: string, opts: { category?: string; origin?: 'batch' | 'on_demand' } = {}) {
  return insertNode({
    identityScope: 'generic',
    normalizedQuestion: question,
    body: `${question} 에 대한 해설`,
    primaryCategory: opts.category ?? '네트워크',
    status: 'ready',
    origin: opts.origin ?? 'batch',
  })
}

async function daily(date: string, nodeId: string, question: string) {
  const db = await getDb()
  await db.query(
    `insert into tree (slug, title, kind, category, summary, root_node_id, publish_date)
     values ($1, $2, 'daily', '네트워크', $3, $4, $5::date)`,
    [`daily-${date}`, question, question, nodeId, date],
  )
}

describe('loadCatalog', () => {
  beforeEach(truncateAll)

  it('collects batch questions with their category', async () => {
    await node('TCP는 무엇을 보장하는가?', { category: '네트워크' })
    await node('인덱스는 언제 안 타는가?', { category: '데이터베이스' })

    const c = await loadCatalog(TODAY)
    expect(c.entries.length).toBe(2)
    expect(c.byCategory.map((g) => g.category)).toEqual(['데이터베이스', '네트워크'])
  })

  /**
   * ready는 "생성이 끝났다"는 뜻이지 "공개해도 된다"는 뜻이 아니다. 남의 자유
   * 입력이 레포에 영구히 박히면 지울 수 없다.
   */
  it('leaves out what users typed themselves', async () => {
    await node('발행된 질문은?', { origin: 'batch' })
    await node('사용자가 판 질문은?', { origin: 'on_demand' })

    const c = await loadCatalog(TODAY)
    expect(c.entries.map((e) => e.question)).toEqual(['발행된 질문은?'])
  })

  /** 화면에서 감춘 것을 레포에 적으면 감춘 의미가 없다 */
  it('leaves out a daily published for a later date', async () => {
    const past = await node('지난 질문은?')
    const future = await node('먼 미래의 질문은?')
    await daily('2020-01-01', past, '지난 질문은?')
    await daily('2099-12-31', future, '먼 미래의 질문은?')

    const c = await loadCatalog(TODAY)
    expect(c.entries.map((e) => e.question)).toEqual(['지난 질문은?'])
  })

  it('carries the publish date when there is one', async () => {
    const id = await node('발행분은?')
    await daily('2026-08-05', id, '발행분은?')

    const c = await loadCatalog(TODAY)
    expect(c.entries[0].publishDate).toBe('2026-08-05')
  })

  it('leaves the publish date empty for an example', async () => {
    await node('예시 질문은?')
    const c = await loadCatalog(TODAY)
    expect(c.entries[0].publishDate).toBeNull()
  })
})

describe('renderCatalog', () => {
  beforeEach(truncateAll)

  it('writes one line per question under its category', async () => {
    const id = await node('TCP는 무엇을 보장하는가?')
    const md = renderCatalog(await loadCatalog(TODAY), 'https://example.com')

    expect(md).toContain('## 네트워크')
    expect(md).toContain(`- [TCP는 무엇을 보장하는가?](https://example.com/q/${id})`)
  })

  it('does not double the slash when the site url ends with one', async () => {
    await node('질문은?')
    const md = renderCatalog(await loadCatalog(TODAY), 'https://example.com/')
    expect(md).not.toContain('example.com//q/')
  })

  /**
   * 질문이 하나 늘었을 때 한 줄만 늘어야 한다. 순서가 흔들리면 diff가 통째로
   * 뒤집혀서 이력이 쓸모없어진다.
   */
  it('keeps the order stable when a question is added', async () => {
    await node('먼저 만든 질문은?')
    const before = renderCatalog(await loadCatalog(TODAY), 'https://example.com')

    await node('나중에 만든 질문은?')
    const after = renderCatalog(await loadCatalog(TODAY), 'https://example.com')

    const removed = before.split('\n').filter((l) => l.startsWith('- ') && !after.includes(l))
    expect(removed).toEqual([])
  })
})

/**
 * 빈 목록이 나가면 워크플로가 그것으로 docs/questions.md를 덮어쓰고 커밋한다.
 * 새벽에 무인으로 도는 자리라 아무도 못 보는 사이에 목록이 지워진다.
 *
 * 라우트가 503으로 떨어뜨리는지는 여기서 못 본다. 여기서 지키는 것은
 * "0개일 때 0개라고 정확히 말한다"는 것 — 그 판단이 라우트의 근거다.
 */
describe('빈 목록', () => {
  beforeEach(truncateAll)

  it('reports zero when nothing qualifies', async () => {
    await node('사용자가 판 질문은?', { origin: 'on_demand' })
    const c = await loadCatalog(TODAY)
    expect(c.entries.length).toBe(0)
    expect(c.byCategory).toEqual([])
  })
})
