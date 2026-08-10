import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'

/**
 * 카카오 오픈빌더 스킬 서버의 약속.
 *
 * - 응답은 언제나 200에 카카오 2.0 규격 — 오픈빌더는 다른 상태 코드를
 *   "스킬 실패"로 처리해 사용자에게 오류 블록을 보여준다. 실패도 말로 한다
 * - "오늘" 발화는 오늘의 질문, 그 외에는 임베딩 유사 질문 검색
 * - 임베딩이 죽어도(429·키 부재) 안내 문구로 산다 — 절대 안 던진다
 */
const mockEmbed = vi.hoisted(() => ({
  impl: null as null | ((texts: string[]) => Promise<number[][]>),
}))
vi.mock('@/lib/embed/gemini', () => ({
  embedQuestions: async (texts: string[]) => {
    if (!mockEmbed.impl) throw new Error('embed unavailable')
    return mockEmbed.impl(texts)
  },
}))

const { POST } = await import('@/app/api/kakao/skill/route')

function skillReq(utterance: string) {
  return new Request('http://localhost/api/kakao/skill', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userRequest: { utterance } }),
  })
}

async function textOf(res: Response): Promise<string> {
  const body = await res.json()
  expect(body.version).toBe('2.0')
  return body.template.outputs[0].simpleText.text
}

beforeEach(async () => {
  await truncateAll()
  mockEmbed.impl = null
})

describe('POST /api/kakao/skill', () => {
  it('오늘의 질문이 아직 없으면 그렇게 말한다 — 200으로', async () => {
    const res = await POST(skillReq('오늘의 질문'))
    expect(res.status).toBe(200)
    expect(await textOf(res)).toContain('아직')
  })

  it('질문 발화는 임베딩으로 비슷한 질문을 찾아 링크와 함께 답한다', async () => {
    const id = await insertNode({
      identityScope: 'network',
      normalizedQuestion: 'TCP 연결은 어떻게 맺는가?',
      body: '세 번의 악수로 맺습니다. 시퀀스 번호를 주고받아 서로의 수신 준비를 확인합니다.',
      primaryCategory: '네트워크',
      status: 'ready',
      origin: 'batch',
    })
    const db = await getDb()
    await db.query(`update qnode set number = 42, embedding = $2::real[] where id = $1`, [
      id,
      [1, 0, 0],
    ])
    // 시험은 3차원으로 — 검색이 쿼리 벡터의 길이로 차원을 잡으므로
    // 문서와 쿼리가 같은 공간이기만 하면 된다
    mockEmbed.impl = async () => [[1, 0, 0]]

    const res = await POST(skillReq('TCP 연결 수립이 궁금해'))
    const text = await textOf(res)
    expect(text).toContain('TCP 연결은 어떻게 맺는가?')
    expect(text).toContain('/q/42')
  })

  it('임베딩이 죽어도 200에 안내 문구 — 던지지 않는다', async () => {
    mockEmbed.impl = null // throw
    const res = await POST(skillReq('아무 질문'))
    expect(res.status).toBe(200)
    expect(await textOf(res)).toContain('cs-pathfinder.vercel.app')
  })

  it('발화가 비어도 200에 도움말', async () => {
    const res = await POST(
      new Request('http://localhost/api/kakao/skill', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(200)
  })
})
