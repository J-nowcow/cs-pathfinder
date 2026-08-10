// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { ReadingView } from '@/components/ReadingView'
import { startJourney, visit } from '@/lib/journey/path'
import { serializeJourney, deserializeJourney, JOURNEY_STORAGE_KEY } from '@/lib/journey/storage'
import { JOURNEY_SYNCED_EVENT } from '@/lib/journey/sync'
import type { JourneyState } from '@/lib/journey/types'

/**
 * 서버 병합이 화면과 만나는 두 지점 (C4).
 *
 * C1 — 동기화 이벤트가 **저장 훅보다 늦게** 도착해도 어느 쪽 발자국도
 *      안 죽는다. 이벤트를 setJourney 병합이 아니라 치환으로 처리하는
 *      되돌림이 여기서 잡힌다. 지난 버그("빈 상태가 덮는다")의 서버판.
 *
 * C2 — 마운트 직후 저장 훅이 복원 전의 1개짜리 상태를 localStorage에
 *      쓰는 일이 한 번도 없다. hydrated 게이트를 지우면 잡힌다 —
 *      게이트 전에는 "한 틱 덮였다 복구"가 실제로 있었고, 그 틱에
 *      언마운트되거나 다른 탭이 읽으면 기록을 잃었다.
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
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function seedTwoNodeJourney() {
  const s0 = startJourney({ id: 'A', question: '질문 A', category: '네트워크' })
  const r = visit(s0, s0.currentId!, { id: 'B', question: '질문 B', category: '네트워크' })
  window.localStorage.setItem(JOURNEY_STORAGE_KEY, serializeJourney(r.state))
}

const stored = () => deserializeJourney(window.localStorage.getItem(JOURNEY_STORAGE_KEY))

describe('동기화 이벤트와 화면의 병합 (C1)', () => {
  it('이벤트가 늦게 도착해도 로컬·서버 발자국이 전부 남는다', async () => {
    seedTwoNodeJourney()
    render(<ReadingView initialNode={NODE} initialQuota={{ used: 0, limit: 5 }} />)

    // 복원이 끝나 A·B·new-one 세 개가 저장될 때까지 — 저장 훅이 이미 돈 상태
    await waitFor(() => {
      expect(stored()!.occurrences).toHaveLength(3)
    })

    // 그 뒤에야 서버 병합 결과가 도착한다 (다른 기기에서 판 C)
    const merged: JourneyState = {
      occurrences: [
        ...stored()!.occurrences,
        { id: 'srv-c', nodeId: 'C', parentId: null, question: '질문 C', category: '운영체제' },
      ],
      currentId: stored()!.currentId,
    }
    window.dispatchEvent(new CustomEvent(JOURNEY_SYNCED_EVENT, { detail: merged }))

    // 화면의 메모리 상태가 병합을 받아들이고, 다음 저장에 C가 실려 있어야 한다
    await waitFor(() => {
      const now = stored()!
      expect(now.occurrences.map((o) => o.nodeId).sort()).toEqual(['A', 'B', 'C', 'new-one'])
    })
  })
})

describe('hydrated 게이트 (C2)', () => {
  it('복원 전의 1개짜리 상태가 localStorage에 쓰이는 일이 없다', async () => {
    seedTwoNodeJourney()
    const writes: number[] = []
    const original = window.localStorage.setItem.bind(window.localStorage)
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === JOURNEY_STORAGE_KEY) {
        writes.push(deserializeJourney(value)?.occurrences.length ?? -1)
      }
      original(key, value)
    })

    render(<ReadingView initialNode={NODE} initialQuota={{ used: 0, limit: 5 }} />)

    await waitFor(() => {
      expect(stored()!.occurrences).toHaveLength(3)
    })

    // 복원 전의 새 여정(길이 1)이 저장소를 스친 적이 한 번도 없어야 한다
    expect(writes).not.toContain(1)
  })
})
