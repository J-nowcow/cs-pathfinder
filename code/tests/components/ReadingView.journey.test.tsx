// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReadingView } from '@/components/ReadingView'
import { startJourney, visit } from '@/lib/journey/path'
import { serializeJourney, deserializeJourney, JOURNEY_STORAGE_KEY } from '@/lib/journey/storage'

/**
 * 새 탭으로 질문을 열었을 때 쌓인 지도가 남는가.
 *
 * **전에는 통째로 날아갔다.** 복원 훅이 "URL 노드가 저장된 여정에 있으면
 * 이어서 판다"만 했고, 없으면 아무것도 안 하고 넘어갔다. 그런데 화면은 이미
 * 1개짜리 새 여정을 들고 있어서, 바로 다음 훅이 그것으로 저장소를 덮었다.
 *
 * 공유 링크를 타고 들어오거나 링크를 새 탭으로 여는 흔한 동작에서 그렇게 됐다.
 * 홈이 "판 만큼 지도가 그려지고요"라고 약속하는 자리다.
 *
 * `enterAsRoot`의 단위 시험만으로는 이 결함이 안 잡힌다. 그때도 함수는
 * 멀쩡했고 **부르지 않은 것**이 문제였다. 그래서 화면째로 건다.
 */
const NODE = {
  id: 'new-one',
  number: 1,
  question: '새로 들어온 질문은?',
  body: '본문이다.',
  identityScope: 'generic',
  category: '네트워크',
  tags: [],
  level: null,
  suggestions: [],
}

beforeEach(() => {
  // 화면이 마운트되며 부수적으로 부르는 것들. 이 시험의 관심사가 아니다
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A ─ B 를 판 상태를 저장소에 심는다 */
function seedTwoNodeJourney() {
  const s0 = startJourney({ id: 'A', question: '질문 A', category: '네트워크' })
  const r = visit(s0, s0.currentId!, { id: 'B', question: '질문 B', category: '네트워크' })
  window.localStorage.setItem(JOURNEY_STORAGE_KEY, serializeJourney(r.state))
}

const stored = () => deserializeJourney(window.localStorage.getItem(JOURNEY_STORAGE_KEY))

describe('여정에 없는 질문으로 들어왔을 때', () => {
  it('이미 판 발자국을 지우지 않는다', async () => {
    seedTwoNodeJourney()
    render(<ReadingView initialNode={NODE} initialQuota={{ used: 0, limit: 5 }} />)

    await waitFor(() => {
      expect(stored()!.occurrences).toHaveLength(3)
    })
    expect(stored()!.occurrences.map((o) => o.nodeId).sort()).toEqual(['A', 'B', 'new-one'])
  })

  it('새 질문을 뿌리로 붙이고 거기 선다', async () => {
    seedTwoNodeJourney()
    render(<ReadingView initialNode={NODE} initialQuota={{ used: 0, limit: 5 }} />)

    await waitFor(() => {
      const s = stored()!
      const added = s.occurrences.find((o) => o.nodeId === 'new-one')!
      expect(added.parentId).toBeNull()
      expect(s.currentId).toBe(added.id)
    })
  })
})

describe('여정에 있는 질문으로 들어왔을 때', () => {
  /* 이 경우는 원래도 맞게 돌았다. 고치면서 깨뜨리지 않았는지 본다 */
  it('발자국을 늘리지 않고 그 자리로 돌아간다', async () => {
    seedTwoNodeJourney()
    const before = stored()!
    const b = before.occurrences.find((o) => o.nodeId === 'B')!

    render(
      <ReadingView
        initialNode={{ ...NODE, id: 'B', question: '질문 B' }}
        initialQuota={{ used: 0, limit: 5 }}
      />,
    )

    await waitFor(() => {
      expect(stored()!.currentId).toBe(b.id)
    })
    expect(stored()!.occurrences).toHaveLength(2)
  })
})

/**
 * 35초를 말없이 두지 않는가.
 *
 * 문구 자체(`ExpandingNote`)는 따로 시험한다. 여기서는 **화면이 그것을 실제로
 * 붙이는지**를 본다 — 원래 결함이 딱 그것이었다. 기다림 문구가 이미 있었는데
 * 빠른 쪽에만 붙어 있고 정작 35초 걸리는 생성에는 없었다.
 */
describe('파고드는 동안', () => {
  it('안내를 띄우고 화면 낭독기에 알린다', async () => {
    // 응답을 붙잡아 둔다. 그 사이가 사용자가 기다리는 시간이다
    let release: (v: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((res) => (release = res))),
    )

    const withSuggestion = {
      ...NODE,
      suggestions: [{ id: 's1', text: '더 궁금한 것은?', resolved: false }],
    }
    const { getByText, queryByRole, findByRole } = render(
      <ReadingView initialNode={withSuggestion} initialQuota={{ used: 0, limit: 5 }} />,
    )

    expect(queryByRole('status')).toBeNull()

    await userEvent.click(getByText('더 궁금한 것은?'))

    const note = await findByRole('status')
    expect(note.textContent).toContain('만드는 중')

    // 뒤처리. 붙잡아 둔 응답을 풀어준다
    release(new Response('{}', { status: 500 }))
  })
})
