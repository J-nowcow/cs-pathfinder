import { beforeEach, describe, expect, it, vi } from 'vitest'
import { truncateAll } from '@/lib/db/client'

const mockUserId = { value: 'user-resume' as string | null }

vi.mock('@/lib/auth/session', () => ({
  readUserId: async () => mockUserId.value,
}))
vi.mock('@/lib/llm/resolve', async () => {
  const { stubCaller } = await import('@/lib/llm/dev-stub')
  return { resolveCaller: () => stubCaller }
})

const { POST } = await import('@/app/api/personalize/resume/route')

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/personalize/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

describe('POST /api/personalize/resume', () => {
  beforeEach(async () => {
    await truncateAll()
    mockUserId.value = 'user-resume'
  })

  it('로그인하지 않으면 원문을 받지 않는다', async () => {
    mockUserId.value = null
    expect((await post({ text: '가'.repeat(120) })).status).toBe(401)
  })

  it('너무 짧은 레쥬메는 400으로 거절한다', async () => {
    const response = await post({ text: '경험이 짧습니다.' })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('invalid_input')
  })

  it('맞춤 질문 5개만 응답하고 원문은 돌려주지 않는다', async () => {
    const response = await post({ text: '서버의 캐시와 동시성을 개선한 경험이 있습니다. '.repeat(6) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.questions).toHaveLength(5)
    expect(JSON.stringify(body)).not.toContain('서버의 캐시와')
    expect(body.quota).toEqual({ used: 1, limit: 3 })
  })

  it('하루 한도를 넘으면 429를 돌려준다', async () => {
    vi.stubEnv('QUOTA_RESUME_DAILY', '1')
    try {
      const text = '서버의 캐시와 동시성을 개선한 경험이 있습니다. '.repeat(6)
      expect((await post({ text })).status).toBe(200)
      expect((await post({ text })).status).toBe(429)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
