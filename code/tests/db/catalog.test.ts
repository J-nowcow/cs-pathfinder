import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { loadCatalog, renderCatalog } from '@/lib/db/catalog'
import { listRoots, countRoots } from '@/lib/db/roots'

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

/**
 * 홈이 목록을 통째로 싣지 않아야 한다.
 *
 * 접어두기만 했을 때는 249개가 전부 문서에 남아 홈 HTML이 447KB였다. 유입이
 * 카톡 링크라 첫 방문 대부분이 폰인데, 오늘 질문 하나 보려고 그만큼을 받는다.
 *
 * 상한을 걸면 **새 것부터** 와야 한다. 상한 없을 때 순서가 오래된 것 먼저라,
 * 거기 상한만 걸면 새 발행분이 먼저 잘려나간다.
 */
describe('listRoots 상한', () => {
  beforeEach(truncateAll)

  /*
   * 시각을 손으로 벌린다.
   *
   * 한 시험 안에서 연달아 넣으면 created_at이 같은 값이 되고, 그러면 2차
   * 정렬(가나다)이 순서를 정한다. 재려는 것은 만들어진 순서지 이름순이 아니다.
   */
  async function nodeAt(question: string, iso: string) {
    const id = await node(question)
    const db = await getDb()
    await db.query('update qnode set created_at = $2 where id = $1', [id, iso])
    return id
  }

  it('takes the newest when a limit is given', async () => {
    await nodeAt('먼저 만든 질문은?', '2026-08-01T00:00:00Z')
    await nodeAt('나중에 만든 질문은?', '2026-08-02T00:00:00Z')

    const limited = await listRoots({ limit: 1 })
    expect(limited.map((r) => r.question)).toEqual(['나중에 만든 질문은?'])
  })

  it('keeps the oldest-first order when there is no limit', async () => {
    await nodeAt('먼저 만든 질문은?', '2026-08-01T00:00:00Z')
    await nodeAt('나중에 만든 질문은?', '2026-08-02T00:00:00Z')

    const all = await listRoots()
    expect(all.map((r) => r.question)).toEqual(['먼저 만든 질문은?', '나중에 만든 질문은?'])
  })

  /** 홈은 열두 개만 보여주지만 "지난 질문 N개"의 N은 전체다 */
  it('counts everything even when the list is capped', async () => {
    await nodeAt('하나는?', '2026-08-01T00:00:00Z')
    await nodeAt('둘은?', '2026-08-02T00:00:00Z')
    await nodeAt('셋은?', '2026-08-03T00:00:00Z')

    expect((await listRoots({ limit: 1 })).length).toBe(1)
    expect(await countRoots()).toBe(3)
  })

  /** 아직 오지 않은 발행분은 세지도 않는다. 목록에서 빼는 것과 같은 기준이다 */
  it('does not count a daily published for a later date', async () => {
    const future = await node('먼 미래의 질문은?')
    await daily('2099-12-31', future, '먼 미래의 질문은?')
    await node('지난 질문은?')

    expect(await countRoots(TODAY)).toBe(1)
  })
})

/**
 * **목록이 태그를 실어 나르는가.**
 *
 * `/questions`의 태그 필터가 이 값으로 거른다. select에서 tags가 빠지면
 * 필터 줄은 그려지는데 어느 태그를 눌러도 0개다 — 화면은 안 깨지고
 * 기능만 조용히 죽는다.
 */
describe('listRoots 태그', () => {
  beforeEach(truncateAll)

  it('태그를 함께 준다', async () => {
    const id = await node('태그 달린 질문은?')
    const db = await getDb()
    await db.query(`update qnode set tags = '{동시성,메모리}' where id = $1`, [id])

    const roots = await listRoots()
    expect(roots.find((r) => r.id === id)?.tags).toEqual(['동시성', '메모리'])
  })

  it('무태그면 빈 배열이다', async () => {
    await node('태그 없는 질문은?')
    const roots = await listRoots()
    expect(roots[0].tags).toEqual([])
  })
})

/** 난이도도 목록에 실려야 /questions 필터가 거를 수 있다 */
describe('listRoots 난이도', () => {
  beforeEach(truncateAll)

  it('난이도를 함께 준다', async () => {
    const id = await node('난이도 달린 질문은?')
    const db = await getDb()
    await db.query(`update qnode set level = '심화' where id = $1`, [id])

    const roots = await listRoots()
    expect(roots.find((r) => r.id === id)?.level).toBe('심화')
  })

  it('미판정이면 null이다', async () => {
    await node('미판정 질문은?')
    const roots = await listRoots()
    expect(roots[0].level).toBeNull()
  })
})
