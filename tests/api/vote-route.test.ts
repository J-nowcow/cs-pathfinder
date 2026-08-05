import { describe, it, expect, beforeEach, vi } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { createSharedTree } from '@/lib/db/trees'
import { VOTER_COOKIE, isVoterId } from '@/lib/vote/identity'
import type { Snapshot } from '@/lib/tree/snapshot'

/**
 * 쿠키 항아리를 가짜로 세운다.
 *
 * 라우트가 next/headers의 cookies()를 쓰는데 vitest에는 요청 컨텍스트가 없다.
 * 여기서 막지 않으면 라우트 자체를 못 부른다.
 *
 * 이 목이 검사하는 것은 "식별자를 처음에만 발급하는가"다. 매번 새로 발급하면
 * 같은 사람이 누를 때마다 새 사람이 되어 표가 무한히 쌓인다.
 */
const jar = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name)
      return value === undefined ? undefined : { name, value }
    },
    set: (name: string, value: string) => {
      jar.set(name, value)
    },
  }),
}))

const { POST } = await import('@/app/api/trees/[slug]/vote/route')

function req(slug: string) {
  return {
    request: new Request(`http://localhost/api/trees/${slug}/vote`, { method: 'POST' }),
    params: Promise.resolve({ slug }),
  }
}

async function makeTree(): Promise<string> {
  const nodeId = await insertNode({
    identityScope: 'network',
    normalizedQuestion: '뿌리 질문은?',
    body: '해설',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'on_demand',
  })

  const snapshot: Snapshot = {
    rootNodeId: nodeId,
    rows: [{ tempId: 't0', nodeId, parentTempId: null, position: 0 }],
  }

  const res = await createSharedTree({ snapshot, title: '테스트 트리' })
  if (!res.ok) throw new Error(res.reason)
  return res.slug
}

describe('POST /api/trees/[slug]/vote', () => {
  beforeEach(async () => {
    jar.clear()
    await truncateAll()
  })

  it('issues a voter id on the first vote and reuses it after', async () => {
    const slug = await makeTree()

    const { request, params } = req(slug)
    const first = await POST(request, { params })
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ upvotes: 1, voted: true })

    const issued = jar.get(VOTER_COOKIE)
    expect(isVoterId(issued)).toBe(true)

    // 두 번째는 같은 식별자를 쓴다. 새로 발급하면 토글이 아니라 또 한 표가 된다
    const second = req(slug)
    const off = await POST(second.request, { params: second.params })
    expect(await off.json()).toEqual({ upvotes: 0, voted: false })
    expect(jar.get(VOTER_COOKIE)).toBe(issued)
  })

  /**
   * 사용자가 고친 쿠키 값이 그대로 DB 키가 되면 아무 문자열이나 들어간다.
   * 모양이 아니면 새로 발급해야 한다.
   */
  it('replaces a tampered voter id', async () => {
    const slug = await makeTree()
    jar.set(VOTER_COOKIE, '../../etc/passwd')

    const { request, params } = req(slug)
    const res = await POST(request, { params })

    expect(res.status).toBe(200)
    expect(isVoterId(jar.get(VOTER_COOKIE))).toBe(true)
  })

  /** 형식이 틀린 주소는 DB까지 안 간다 */
  it('rejects a malformed slug', async () => {
    const { request, params } = req('nope')
    const res = await POST(request, { params })
    expect(res.status).toBe(404)
  })

  it('404s a well-formed slug that does not exist', async () => {
    const { request, params } = req('zzzzzzzzzzzz')
    const res = await POST(request, { params })
    expect(res.status).toBe(404)
  })

  it('never caches the response', async () => {
    const slug = await makeTree()
    const { request, params } = req(slug)
    const res = await POST(request, { params })
    expect(res.headers.get('cache-control')).toContain('no-store')
  })
})
