import { describe, it, expect, beforeEach, vi } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'

/**
 * 노드 챗 라우트.
 *
 * 여기서 제일 비싼 실수는 둘이다. 쿼터를 세지 않아 익명 호출이 모델
 * 비용을 무한정 쓰는 것, 그리고 실패한 호출이 예약을 물고 있어 하루
 * 몫이 헛되이 줄어드는 것.
 *
 * 시드는 끈다 — 이 시험이 보는 것은 라우트의 배선이다. caller는 dev
 * 스텁으로 고정해 실모델을 부르지 않는다.
 */
vi.mock('@/lib/db/bootstrap', () => ({ ensureSeeded: async () => {} }))
vi.mock('@/lib/llm/resolve', async () => {
  const { stubCaller } = await import('@/lib/llm/dev-stub')
  return { resolveCaller: () => stubCaller }
})

const { POST } = await import('@/app/api/chat/route')

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.9' },
      body: JSON.stringify(body),
    }),
  )
}

async function mk(): Promise<string> {
  return insertNode({
    identityScope: 'generic',
    normalizedQuestion: 'CORS는 무엇을 막는가?',
    body: '응답 읽기를 막는다.',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'batch',
  })
}

describe('POST /api/chat', () => {
  beforeEach(truncateAll)

  it('모양이 어긋나면 400이다', async () => {
    const res = await post({ node_id: 'not-a-uuid', text: '설명해 주세요' })
    expect(res.status).toBe(400)
  })

  it('없는 노드면 404다', async () => {
    const res = await post({
      node_id: '00000000-0000-4000-8000-000000000000',
      text: '설명해 주세요',
    })
    expect(res.status).toBe(404)
  })

  it('스텁이 질문을 되읽은 답을 주고 쿼터가 줄어든다', async () => {
    const id = await mk()
    const res = await post({ node_id: id, text: '쉽게 설명해 주세요' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.answer).toContain('쉽게 설명해 주세요')
    expect(json.quota.used).toBe(1)
    expect(json.quota.limit).toBeGreaterThan(0)
  })

  it('이력을 실어도 답이 온다', async () => {
    const id = await mk()
    const res = await post({
      node_id: id,
      history: [
        { role: 'user', text: '어렵습니다' },
        { role: 'assistant', text: '이렇게 보면 됩니다' },
      ],
      text: '더 쉽게요',
    })
    expect(res.status).toBe(200)
  })

  it('한도가 다하면 429다', async () => {
    vi.stubEnv('QUOTA_CHAT_DAILY', '1')
    try {
      const id = await mk()
      expect((await post({ node_id: id, text: '첫 질문입니다' })).status).toBe(200)
      const res = await post({ node_id: id, text: '두 번째 질문입니다' })
      expect(res.status).toBe(429)
      const json = await res.json()
      expect(json.error).toBe('quota_exceeded')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
