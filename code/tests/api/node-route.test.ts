import { describe, it, expect, beforeEach, vi } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { saveRelations } from '@/lib/db/relations'

/**
 * 공개 노드 조회가 관련 질문까지 싣는가.
 *
 * 이 응답은 **공개 캐시**(`public, max-age=60`)에 올라간다. 관련 질문은
 * 노드에 딸린 값이라 누가 물어도 같으므로 실어도 안전하다. 반대로 경로·할당량
 * 같은 개인 상태가 한 칸이라도 섞이면 그 순간 캐시가 사용자 사이로 샌다.
 * 그래서 키 목록 자체를 시험이 붙들고 있는다.
 *
 * 시드는 끈다. 이 시험이 보는 것은 라우트의 배선이지 291편의 예시가 아니고,
 * 매번 심으면 무엇이 목록에 왜 들어왔는지 알 수 없다.
 */
vi.mock('@/lib/db/bootstrap', () => ({ ensureSeeded: async () => {} }))

const { GET } = await import('@/app/api/node/[id]/route')

function get(id: string) {
  return GET(new Request(`http://localhost/api/node/${id}`), {
    params: Promise.resolve({ id }),
  })
}

async function mk(question: string, category = '네트워크'): Promise<string> {
  return insertNode({
    identityScope: 'generic',
    normalizedQuestion: question,
    body: '해설',
    primaryCategory: category,
    status: 'ready',
    origin: 'batch',
  })
}

describe('GET /api/node/[id]', () => {
  beforeEach(truncateAll)

  it('관련 질문을 함께 준다', async () => {
    const focus = await mk('TCP는 왜 3번 인사하는가?')
    const other = await mk('UDP는 왜 인사를 안 하는가?', '네트워크')
    await saveRelations([
      {
        fromId: focus,
        toId: other,
        kind: 'alternative',
        source: 'llm',
        reason: '같은 문제의 다른 선택지다',
        votes: 3,
      },
    ])

    const json = await (await get(focus)).json()
    expect(json.related).toHaveLength(1)
    expect(json.related[0].question).toBe('UDP는 왜 인사를 안 하는가?')
    expect(json.related[0].reason).toBe('같은 문제의 다른 선택지다')
    expect(json.related[0].category).toBe('네트워크')
    /* 링크가 `/q/{번호}`로 간다. 번호가 없으면 목록을 그릴 수 없다 */
    expect(json.related[0].number).toBeGreaterThan(0)
  })

  it('이어진 것이 없으면 빈 목록이다', async () => {
    const focus = await mk('외톨이 질문은?')
    const json = await (await get(focus)).json()
    expect(json.related).toEqual([])
  })

  /**
   * 키가 하나 늘어날 때마다 이 시험이 걸린다. 그게 이 시험의 일이다 —
   * 공개 캐시에 실리는 응답에 개인 필드가 붙는 순간을 사람이 알아채야 한다.
   */
  it('개인 상태는 한 칸도 싣지 않는다', async () => {
    const focus = await mk('질문은?')
    const json = await (await get(focus)).json()

    expect(Object.keys(json).sort()).toEqual(
      [
        'body',
        'category',
        'id',
        'identity_scope',
        'level',
        'number',
        'question',
        'related',
        'suggestions',
        'tags',
      ].sort(),
    )
  })

  it('공개 캐시로 짧게 둔다', async () => {
    const focus = await mk('질문은?')
    const cc = (await get(focus)).headers.get('cache-control') ?? ''
    expect(cc).toContain('public')
    expect(cc).not.toContain('no-store')
    expect(Number(/max-age=(\d+)/.exec(cc)?.[1] ?? '9999')).toBeLessThanOrEqual(60)
  })

  it('없는 노드는 404다', async () => {
    const res = await get('99999999-9999-9999-9999-999999999999')
    expect(res.status).toBe(404)
  })
})
