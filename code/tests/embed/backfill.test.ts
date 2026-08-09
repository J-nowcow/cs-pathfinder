import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { backfillEmbedding, sweepEmbeddings, type EmbedFn } from '@/lib/embed/backfill'

/**
 * **빈 임베딩을 채우는 두 경로.**
 *
 * 백필은 fail-open이고 스윕이 그물이다. 백필이 던지면 확장 응답이 죽고,
 * 스윕이 조용하면 실패가 쌓여도 아무도 모른다. 그래서 지키는 것이 서로
 * 다르다 — 백필은 "안 던진다", 스윕은 "실패를 세서 알린다".
 *
 * 임베딩 함수는 주입한다. 시험이 Gemini를 부르면 안 된다.
 */
beforeEach(truncateAll)

const mk = (q: string) =>
  insertNode({
    identityScope: 'generic',
    normalizedQuestion: q,
    body: '본문',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'on_demand',
  })

const VEC = [0.6, 0.8]
const fakeEmbed: EmbedFn = async (texts) => texts.map(() => VEC)

async function embeddingOf(id: string): Promise<number[] | null> {
  const db = await getDb()
  const rows = await db.query<{ embedding: number[] | null }>(
    `select embedding from qnode where id = $1`,
    [id],
  )
  return rows[0].embedding
}

describe('backfillEmbedding', () => {
  it('빈 노드를 채운다', async () => {
    const id = await mk('새 질문?')
    await backfillEmbedding(id, fakeEmbed)
    expect(await embeddingOf(id)).toEqual(VEC)
  })

  it('이미 차 있으면 모델을 부르지 않는다', async () => {
    const id = await mk('이미 있음?')
    const db = await getDb()
    await db.query(`update qnode set embedding = $2::real[] where id = $1`, [id, [1, 0]])

    const spy = vi.fn(fakeEmbed)
    await backfillEmbedding(id, spy)

    expect(spy).not.toHaveBeenCalled()
    expect(await embeddingOf(id)).toEqual([1, 0])
  })

  /**
   * `after()` 안에서 돌므로 던져 봐야 받는 사람이 없다. 실패는 NULL로
   * 남기고 스윕에 넘긴다. **이 시험이 깨지면 확장 응답이 임베딩 장애에
   * 물려 죽을 수 있다는 뜻이다.**
   */
  it('모델이 죽어도 던지지 않는다', async () => {
    const id = await mk('실패할 질문?')
    const dying: EmbedFn = async () => {
      throw new Error('quota')
    }

    await expect(backfillEmbedding(id, dying)).resolves.toBeUndefined()
    expect(await embeddingOf(id)).toBeNull()
  })
})

describe('sweepEmbeddings', () => {
  it('빈 것을 모아 채우고 개수를 준다', async () => {
    const a = await mk('하나?')
    const b = await mk('둘?')

    const result = await sweepEmbeddings(200, fakeEmbed)

    expect(result).toEqual({ scanned: 2, filled: 2, failed: 0 })
    expect(await embeddingOf(a)).toEqual(VEC)
    expect(await embeddingOf(b)).toEqual(VEC)
  })

  it('찬 것은 건드리지 않는다', async () => {
    const id = await mk('이미 있음?')
    const db = await getDb()
    await db.query(`update qnode set embedding = $2::real[] where id = $1`, [id, [1, 0]])

    const result = await sweepEmbeddings(200, fakeEmbed)

    expect(result.scanned).toBe(0)
    expect(await embeddingOf(id)).toEqual([1, 0])
  })

  /**
   * 실패를 **세서 돌려줘야** 한다. 라우트가 이 수를 보고 5xx를 들고,
   * 워크플로가 그것을 빨간불로 바꾼다. 0으로 삼키면 launchd 데일리
   * 아카이브처럼 한 달을 조용히 실패한다.
   */
  it('모델이 죽으면 실패로 센다', async () => {
    await mk('실패할 질문?')
    const dying: EmbedFn = async () => {
      throw new Error('quota')
    }

    const result = await sweepEmbeddings(200, dying)

    expect(result.failed).toBe(1)
    expect(result.filled).toBe(0)
  })

  it('ready가 아닌 노드는 줍지 않는다', async () => {
    await insertNode({
      identityScope: 'generic',
      normalizedQuestion: '대기 중?',
      body: '',
      primaryCategory: '네트워크',
      status: 'pending',
      origin: 'on_demand',
    })

    const result = await sweepEmbeddings(200, fakeEmbed)
    expect(result.scanned).toBe(0)
  })
})
