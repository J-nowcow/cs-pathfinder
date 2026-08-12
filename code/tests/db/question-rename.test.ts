import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'
import { QUESTION_RENAMES } from '../../data/renames'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'

/**
 * **제목을 바꿔도 행이 갈라지지 않는가.**
 *
 * 부팅 시드는 `normalized_question`으로 기존 행을 찾는다. 그래서 파일에서
 * 제목만 고치면 그 행을 **못 찾고 새 행을 하나 더 만든다.** 옛 행은 옛
 * 제목으로 목록에 그대로 남고, 짧은 주소는 옛 글을 가리킨다.
 *
 * 실제로 당했다. 26편을 파일로 꺼냈을 때 같은 일로 **291행이 317행이 됐고**
 * 화면은 옛 행을 계속 내보냈다. 배포하고 폰으로 열어 보고서야 알았다.
 *
 * 눈으로는 안 잡힌다. 화면도 글도 멀쩡하고 **옛 것일 뿐**이다.
 */
beforeEach(async () => {
  await resetDb()
  /* 약속이 캐싱된다. 안 비우면 새 DB에 아무것도 안 심긴다 */
  resetSeedCache()
})

const ALL = [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES]

describe('제목 바꾸기', () => {
  /*
   * 표가 비면 아래 시험이 아무것도 안 지킨다. 먼저 있는지 본다.
   */
  it('바꾼 기록이 실제로 있다', () => {
    expect(QUESTION_RENAMES.length).toBeGreaterThan(0)
  })

  /**
   * `to`가 데이터 파일과 한 글자라도 다르면 시드가 그 행을 영영 못 찾는다.
   * 옛 제목이 화면에 그대로 남고 아무도 모른다.
   */
  it('바꾼 뒤 제목이 데이터 파일에 그대로 있다', () => {
    const questions = new Set(ALL.map((n) => n.question.trim()))
    const missing = QUESTION_RENAMES.filter((r) => !questions.has(r.to.trim())).map((r) => r.to)
    expect(missing).toEqual([])
  })

  /** 옛 제목이 아직 파일에 남아 있으면 바꾸다 만 것이다 */
  it('옛 제목은 데이터 파일에 없다', () => {
    const questions = new Set(ALL.map((n) => n.question.trim()))
    const left = QUESTION_RENAMES.filter((r) => questions.has(r.from.trim())).map((r) => r.from)
    expect(left).toEqual([])
  })

  it('옛 제목으로 저장된 행을 찾아 제목만 고친다', async () => {
    const db = await getDb()
    const r = QUESTION_RENAMES[0]

    /* 바꾸기 전 상태를 흉내 낸다 -- 옛 제목으로 이미 저장돼 있다 */
    await db.query(
      `insert into qnode (id, identity_scope, normalized_question, body, primary_category, status, origin, number)
       values ('44444444-3333-2222-1111-000000000000', 'generic', $1, '옛 글이다', '네트워크', 'ready', 'batch', 9100)`,
      [r.from],
    )

    await ensureSeeded()

    const rows = await db.query<{ id: string; q: string; number: number; scope: string }>(
      `select id, normalized_question q, number, identity_scope scope from qnode where normalized_question = any($1)`,
      [[r.from, r.to]],
    )

    /* 둘이면 갈라진 것이다. 목록에 같은 질문이 두 번 뜬다 */
    expect(rows.length).toBe(1)
    expect(rows[0].q).toBe(r.to)
    expect(rows[0].id).toBe('44444444-3333-2222-1111-000000000000')
    expect(rows[0].scope).toBe(EXAMPLE_NODES.find((node) => node.question === r.to)?.identityScope)
    /* 번호를 지켜야 한다. 새로 매기면 옛 주소가 죽는다 */
    expect(rows[0].number).toBe(9100)
  })

  it('같은 현재 제목에 옛 제목이 여러 개여도 어느 행이든 이어받는다', async () => {
    const db = await getDb()
    const r = QUESTION_RENAMES.find((rename) => rename.from.includes('뷰 포스팅'))
    expect(r).toBeDefined()

    await db.query(
      `insert into qnode (id, identity_scope, normalized_question, body, primary_category, status, origin, number)
       values ('55555555-3333-2222-1111-000000000000', 'sql', $1, '옛 글이다', '데이터베이스', 'ready', 'batch', 9200)`,
      [r!.from],
    )

    await ensureSeeded()

    const rows = await db.query<{ id: string; q: string; number: number }>(
      `select id, normalized_question q, number from qnode where normalized_question = any($1)`,
      [[r!.from, r!.to]],
    )
    expect(rows).toEqual([
      { id: '55555555-3333-2222-1111-000000000000', q: r!.to, number: 9200 },
    ])
  })

  it('바꾼 제목이 목록에 두 번 뜨지 않는다', async () => {
    await ensureSeeded()
    const db = await getDb()
    for (const r of QUESTION_RENAMES) {
      const rows = await db.query<{ c: number }>(
        `select count(*)::int c from qnode where normalized_question = $1`,
        [r.to],
      )
      expect(rows[0].c).toBeLessThanOrEqual(1)
    }
  })
})
