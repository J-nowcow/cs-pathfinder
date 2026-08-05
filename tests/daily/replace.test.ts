import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { publishDaily } from '@/lib/daily/publish'
import { findDailyTree } from '@/lib/daily/today'
import type { StructuredCaller } from '@/lib/llm/client'

/**
 * 발행분 교체.
 *
 * 예전에는 재발행 스크립트가 먼저 지우고 그 다음에 발행을 불렀다. 생성이 한도에
 * 걸려 실패하자 그날 질문이 통째로 사라졌다. 실제로 났던 사고다.
 *
 * 지금은 새 내용을 손에 쥔 뒤에 옛것을 지운다. 아래 두 번째 테스트가 그 성질을
 * 붙잡는다 — 나머지가 다 맞아도 여기가 깨지면 같은 사고가 다시 난다.
 */

const DATE = '2026-03-14'

function caller(question: string): StructuredCaller {
  return async <T,>() =>
    ({
      question,
      identity_scope: 'generic',
      body: `${question}에 대한 해설이다.`,
      summary: `${question} 요약이다.`,
      suggestions: [{ text: '더 깊게는?' }],
    }) as T
}

const explode: StructuredCaller = async () => {
  throw new Error('한도에 걸렸다')
}

async function seedTopics(n: number) {
  const db = await getDb()
  for (let i = 0; i < n; i += 1) {
    await db.query('insert into topic_seed (term, category) values ($1, $2)', [
      `주제어 ${i}`,
      '네트워크',
    ])
  }
}

async function unconsumed(): Promise<number> {
  const rows = await (await getDb()).query<{ n: string }>(
    'select count(*) as n from topic_seed where consumed_at is null',
  )
  return Number(rows[0].n)
}

describe('publishDaily — replace', () => {
  beforeEach(async () => {
    await truncateAll()
    await seedTopics(5)
  })

  it('refuses to touch an existing day without the flag', async () => {
    await publishDaily({ date: DATE, call: caller('첫 질문은?') })

    const again = await publishDaily({ date: DATE, call: caller('둘째 질문은?') })
    expect(again.kind).toBe('already_published')

    const tree = await findDailyTree(DATE)
    expect(tree?.root.question).toBe('첫 질문은?')
  })

  /**
   * 이 수정의 전부다. 생성이 실패하면 옛 발행분이 그대로 남아야 한다.
   * 먼저 지우는 구조에서는 여기서 그날이 비어버렸다.
   */
  it('keeps the old day when generation fails', async () => {
    await publishDaily({ date: DATE, call: caller('원래 질문은?') })
    const before = await unconsumed()

    const failed = await publishDaily({ date: DATE, replace: true, call: explode })
    expect(failed.kind).toBe('generation_failed')

    const tree = await findDailyTree(DATE)
    expect(tree).not.toBeNull()
    expect(tree?.root.question).toBe('원래 질문은?')

    // 실패한 시도가 시드를 먹으면 400개가 조용히 녹는다
    expect(await unconsumed()).toBe(before)
  })

  it('swaps the day when generation succeeds', async () => {
    await publishDaily({ date: DATE, call: caller('원래 질문은?') })

    const out = await publishDaily({ date: DATE, replace: true, call: caller('새 질문은?') })
    expect(out.kind).toBe('published')

    const tree = await findDailyTree(DATE)
    expect(tree?.root.question).toBe('새 질문은?')
  })

  /** 하루에 트리 하나. 교체가 두 벌을 남기면 홈이 주인공을 못 고른다 */
  it('leaves exactly one tree for that day', async () => {
    await publishDaily({ date: DATE, call: caller('원래 질문은?') })
    await publishDaily({ date: DATE, replace: true, call: caller('새 질문은?') })

    const rows = await (await getDb()).query<{ n: string }>(
      `select count(*) as n from tree where kind = 'daily' and publish_date = $1::date`,
      [DATE],
    )
    expect(Number(rows[0].n)).toBe(1)
  })

  /**
   * 버린 주제어는 되돌아와야 한다. 그러지 않으면 재발행할 때마다 하루치가 녹는다.
   * 교체 뒤 소비량은 늘 1이다 — 옛것을 되돌리고 새것을 하나 쓴다.
   */
  it('gives the discarded topic back', async () => {
    const start = await unconsumed()

    await publishDaily({ date: DATE, call: caller('원래 질문은?') })
    expect(await unconsumed()).toBe(start - 1)

    await publishDaily({ date: DATE, replace: true, call: caller('새 질문은?') })
    expect(await unconsumed()).toBe(start - 1)
  })

  /** 옛 루트 노드가 남으면 아무 트리에도 안 속한 유령이 홈 목록에 뜬다 */
  it('does not leave the old root behind', async () => {
    await publishDaily({ date: DATE, call: caller('원래 질문은?') })
    await publishDaily({ date: DATE, replace: true, call: caller('새 질문은?') })

    const rows = await (await getDb()).query<{ q: string }>(
      `select normalized_question as q from qnode where origin = 'batch'`,
    )
    expect(rows.map((r) => r.q)).toEqual(['새 질문은?'])
  })
})
