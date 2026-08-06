import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { derivedUuid } from '@/lib/db/uuid'
import { seedExampleNodes, ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'
import { listRoots } from '@/lib/db/roots'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'

/**
 * 부팅 때 심는 것은 손으로 쓴 예시와 생성된 노드를 합친 것이다.
 * 파일은 나눠 두지만(기준선을 지키려고) 심을 때는 둘 다 화면에 나가는 콘텐츠다.
 */
const SEEDED = EXAMPLE_NODES.length + GENERATED_NODES.length

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('derivedUuid', () => {
  it('is stable for the same seed', () => {
    expect(derivedUuid('a')).toBe(derivedUuid('a'))
  })

  it('differs for a different seed', () => {
    expect(derivedUuid('a')).not.toBe(derivedUuid('b'))
  })

  it('has uuid v4 shape so postgres accepts it', () => {
    expect(derivedUuid('TCP 3-way handshake란?')).toMatch(UUID_SHAPE)
  })
})

describe('seedExampleNodes', () => {
  beforeEach(truncateAll)

  it('inserts every example root', async () => {
    const r = await seedExampleNodes()
    expect(r.inserted).toBe(SEEDED)

    const db = await getDb()
    const rows = await db.query<{ n: string }>(
      "select count(*) as n from qnode where origin = 'batch'",
    )
    expect(Number(rows[0].n)).toBe(SEEDED)
  })

  it('is idempotent so a second boot does not duplicate', async () => {
    await seedExampleNodes()
    const second = await seedExampleNodes()
    expect(second.inserted).toBe(0)

    const db = await getDb()
    const rows = await db.query<{ n: string }>('select count(*) as n from qnode')
    expect(Number(rows[0].n)).toBe(SEEDED)
  })

  it('gives each node a derived id so urls survive a restart', async () => {
    await seedExampleNodes()
    const first = EXAMPLE_NODES[0]

    const db = await getDb()
    const rows = await db.query<{ id: string }>(
      'select id from qnode where normalized_question = $1',
      [first.question],
    )
    expect(rows[0].id).toBe(derivedUuid(`node:${first.identityScope}:${first.question}`))
  })

  it('attaches the suggestions of each root', async () => {
    await seedExampleNodes()
    const first = EXAMPLE_NODES[0]
    const nodeId = derivedUuid(`node:${first.identityScope}:${first.question}`)

    const db = await getDb()
    const rows = await db.query<{ text: string }>(
      'select text from qnode_suggestion where qnode_id = $1 order by position',
      [nodeId],
    )
    expect(rows.map((r) => r.text)).toEqual(first.suggestions)
  })

  /*
   * 노드마다 별칭이 최소 하나, 스코프가 스키마 밖이면 둘이다.
   *
   * 원래 여기는 `toBe(SEEDED)`였다. 노드당 정확히 하나를 전제했는데 그 전제가
   * 문제였다 — 시드 53개가 목록 밖 스코프를 쓰고, 게이트는 그것을 `generic`으로
   * 강제하므로 시드가 단 해시로는 영영 안 걸렸다. 두 벌을 달아 고쳤고 그만큼
   * 행이 늘었다.
   *
   * 정확한 수를 박지 않는다. 데이터가 늘 때마다 이 숫자를 고치게 되고, 그러면
   * 시험이 "확인"이 아니라 "받아쓰기"가 된다. 지켜야 할 성질은 **모든 노드가
   * 적어도 하나로 닿는다**는 것이다. 게이트 해시로 닿는지는
   * `seed-alias.test.ts`가 249개 전수로 본다.
   */
  it('binds an alias so the cache can find the root by hash', async () => {
    await seedExampleNodes()
    const db = await getDb()

    const [{ n }] = await db.query<{ n: string }>('select count(*) as n from qnode_alias')
    expect(Number(n)).toBeGreaterThanOrEqual(SEEDED)

    const [{ n: orphans }] = await db.query<{ n: string }>(
      `select count(*) as n from qnode
        where not exists (select 1 from qnode_alias a where a.qnode_id = qnode.id)`,
    )
    expect(Number(orphans), '별칭 없는 노드는 캐시에 영영 안 걸린다').toBe(0)
  })
})

describe('ensureSeeded', () => {
  beforeEach(async () => {
    await truncateAll()
    resetSeedCache()
  })

  it('runs the seed only once even under concurrent callers', async () => {
    // 불리언 플래그는 첫 호출이 끝나기 전에 두 번째 호출이 통과한다.
    // promise 캐싱이라야 동시 요청에서 시드가 두 번 돌지 않는다.
    await Promise.all([ensureSeeded(), ensureSeeded(), ensureSeeded()])

    const db = await getDb()
    const rows = await db.query<{ n: string }>('select count(*) as n from qnode')
    expect(Number(rows[0].n)).toBe(SEEDED)
  })
})

describe('listRoots', () => {
  beforeEach(truncateAll)

  it('returns nothing before seeding', async () => {
    expect(await listRoots()).toEqual([])
  })

  it('returns every seeded root with question and category', async () => {
    await seedExampleNodes()
    const roots = await listRoots()

    expect(roots).toHaveLength(SEEDED)
    for (const r of roots) {
      expect(r.question.length).toBeGreaterThan(0)
      expect(r.category.length).toBeGreaterThan(0)
    }
  })

  it('excerpts the first paragraph of the body for card display', async () => {
    await seedExampleNodes()
    const roots = await listRoots()
    const target = roots.find((r) => r.question === EXAMPLE_NODES[0].question)

    expect(target!.excerpt).toBe(EXAMPLE_NODES[0].body.split('\n\n')[0])
  })
})
