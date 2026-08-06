import { getDb } from '@/lib/db/client'
import type { StructuredCaller, StructuredCallArgs } from '@/lib/llm/client'

/** 프롬프트에서 주제어를 되읽는다. 스텁이 시드마다 다른 질문을 내게 하려는 것 */
const TERM = /^주제어:\s*(.+)$/m

export type SpyCaller = StructuredCaller & { calls: string[] }

/**
 * 매일 발행용 가짜 caller.
 *
 * 실제 모델을 부르지 않으면서 호출 횟수를 센다. "두 번째 발행은 LLM을 안 탄다"를
 * 증명하려면 횟수가 필요하다.
 */
export function makeCaller(shape?: (term: string) => unknown): SpyCaller {
  const calls: string[] = []

  const caller = (async <T,>({ prompt }: StructuredCallArgs<T>): Promise<T> => {
    calls.push(prompt)
    const term = TERM.exec(prompt)?.[1]?.trim() ?? '주제'
    if (shape) return shape(term) as T

    return {
      question: `${term}는 왜 필요한가?`,
      identity_scope: 'generic',
      body: `${term} 해설 첫 문단.\n\n두 번째 문단.`,
      summary: `${term} 한 줄 요약`,
      suggestions: [1, 2, 3, 4, 5].map((n) => ({ text: `${term} 꼬리질문 ${n}?` })),
    } as T
  }) as SpyCaller

  caller.calls = calls
  return caller
}

/** 항상 터지는 caller. 생성 실패 경로 검증용 */
export const failingCaller: StructuredCaller = async () => {
  throw new Error('generation blew up')
}

export async function insertSeeds(rows: Array<{ term: string; category: string }>): Promise<void> {
  const db = await getDb()
  for (const r of rows) {
    await db.query(
      `insert into topic_seed (term, category) values ($1, $2)
       on conflict (term, category) do nothing`,
      [r.term, r.category],
    )
  }
}

export async function countRows(table: string, where = ''): Promise<number> {
  const db = await getDb()
  const rows = await db.query<{ n: string }>(
    `select count(*) as n from ${table} ${where ? `where ${where}` : ''}`,
  )
  return Number(rows[0].n)
}
