// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { startJourney, visit } from '@/lib/journey/path'
import { serializeJourney, JOURNEY_STORAGE_KEY, loadJourney } from '@/lib/journey/storage'
import { STREAK_STORAGE_KEY } from '@/lib/streak/storage'
import {
  syncForUser,
  __resetSyncForTests,
  SYNC_MARKER_KEY,
  JOURNEY_SYNCED_EVENT,
} from '@/lib/journey/sync'

/**
 * 동기화의 세 가지 약속.
 *
 * S1 탭 세션당 한 번 — 마커가 맞으면 네트워크를 아예 안 탄다
 * S2 실패하면 아무것도 안 바꾼다 — 로컬은 사용자가 실제로 판 기록이다
 * S3 성공하면 병합본을 저장하고 이벤트로 알린다 — localStorage만 고치면
 *    떠 있는 화면의 저장 훅이 옛 메모리로 도로 덮는다
 */

function seedLocalJourney() {
  const start = startJourney({ id: '11111111-1111-1111-1111-111111111111', question: 'A?', category: '망' })
  const state = visit(start, start.currentId!, {
    id: '22222222-2222-2222-2222-222222222222',
    question: 'B?',
    category: '망',
  }).state
  window.localStorage.setItem(JOURNEY_STORAGE_KEY, serializeJourney(state))
  return state
}

function okJson(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  __resetSyncForTests()
  vi.restoreAllMocks()
})

describe('syncForUser', () => {
  it('S1 마커가 이 사용자면 아무것도 안 부른다', async () => {
    window.sessionStorage.setItem(SYNC_MARKER_KEY, 'u1')
    const spy = vi.spyOn(globalThis, 'fetch')
    expect(await syncForUser('u1')).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('S1 다른 사용자가 로그인하면 다시 돈다', async () => {
    window.sessionStorage.setItem(SYNC_MARKER_KEY, 'u1')
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okJson({ occurrences: [], current_id: null, days: {} }))
    await syncForUser('u2')
    expect(spy).toHaveBeenCalled()
  })

  it('S2 서버가 실패하면 localStorage가 그대로고 마커도 없다', async () => {
    seedLocalJourney()
    const before = window.localStorage.getItem(JOURNEY_STORAGE_KEY)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('죽음', { status: 500 }))

    expect(await syncForUser('u1')).toBe(false)
    expect(window.localStorage.getItem(JOURNEY_STORAGE_KEY)).toBe(before)
    expect(window.sessionStorage.getItem(SYNC_MARKER_KEY)).toBeNull()
  })

  it('S2 네트워크 예외도 같다 — 절대 던지지 않는다', async () => {
    seedLocalJourney()
    const before = window.localStorage.getItem(JOURNEY_STORAGE_KEY)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('오프라인'))

    expect(await syncForUser('u1')).toBe(false)
    expect(window.localStorage.getItem(JOURNEY_STORAGE_KEY)).toBe(before)
  })

  it('S3 성공하면 병합본이 저장되고 이벤트가 난다', async () => {
    seedLocalJourney() // A>B 로컬

    const serverJourney = {
      occurrences: [
        {
          id: 'srv-9',
          node_id: '33333333-3333-3333-3333-333333333333',
          parent_id: null,
          question: 'C?',
          category: '운영체제',
        },
      ],
      current_id: 'srv-9',
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/api/journey/merge')) return okJson(serverJourney)
      if (url.includes('/api/streak/merge')) return okJson({ days: { '2026-08-01': [] } })
      throw new Error(`unexpected: ${url}`)
    })

    const heard: unknown[] = []
    window.addEventListener(JOURNEY_SYNCED_EVENT, (e) => heard.push((e as CustomEvent).detail))

    expect(await syncForUser('u1')).toBe(true)

    // 로컬 2 + 서버 1 = 3. 어느 쪽도 안 지워졌다
    const saved = loadJourney()!
    expect(saved.occurrences).toHaveLength(3)
    expect(heard).toHaveLength(1)
    expect(window.sessionStorage.getItem(SYNC_MARKER_KEY)).toBe('u1')
    // 잔디도 저장됐다
    expect(window.localStorage.getItem(STREAK_STORAGE_KEY)).not.toBeNull()
  })

  it('S2-잔디 잔디만 실패해도 마커는 안 남는다 — 다음에 다시 온다 (여정은 멱등이라 안전)', async () => {
    seedLocalJourney()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/api/journey/merge'))
        return okJson({ occurrences: [], current_id: null })
      return new Response('죽음', { status: 500 })
    })

    expect(await syncForUser('u1')).toBe(false)
    expect(window.sessionStorage.getItem(SYNC_MARKER_KEY)).toBeNull()
  })
})

describe('보내기 전 정화 (S4)', () => {
  it('미아 부모가 있는 옛 여정도 정화되어 올라간다 — 정화를 지우면 400 무한 실패로 돌아간다', async () => {
    // 부모가 잘려 나간 발자국 — 옛 버전이 남긴 모양 그대로
    window.localStorage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        occurrences: [
          { id: 'x', nodeId: '44444444-4444-4444-4444-444444444444', parentId: 'ghost', question: 'X?', category: '망' },
        ],
        currentId: 'x',
      }),
    )

    let sentBody: { occurrences: Array<{ parent_id: string | null }> } | null = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.includes('/api/journey/merge')) {
        sentBody = JSON.parse(String(init?.body))
        return okJson({ occurrences: [], current_id: null })
      }
      return okJson({ days: {} })
    })

    await syncForUser('u1')
    expect(sentBody).not.toBeNull()
    expect(sentBody!.occurrences[0].parent_id).toBeNull()
  })
})
