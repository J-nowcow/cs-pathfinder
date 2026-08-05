import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  pruneJourney,
  loadJourney,
  saveJourney,
  serializeJourney,
  MAX_OCCURRENCES,
  JOURNEY_STORAGE_KEY,
} from '@/lib/journey/storage'
import { startJourney, visit } from '@/lib/journey/path'
import type { JourneyState, VisitedNode } from '@/lib/journey/types'

const node = (id: string): VisitedNode => ({ id, question: `질문 ${id}`, category: '네트워크' })

/** 한 줄기로 n칸 판 여정 */
function chain(n: number): JourneyState {
  let s = startJourney(node('n0'))
  for (let i = 1; i < n; i += 1) s = visit(s, s.currentId!, node(`n${i}`)).state
  return s
}

/** 뿌리 하나에 자식 n개가 붙은 여정. 현재 위치는 뿌리다 */
function fan(n: number): JourneyState {
  let s = startJourney(node('root'))
  const rootId = s.currentId!
  for (let i = 0; i < n; i += 1) s = visit(s, rootId, node(`c${i}`)).state
  return { ...s, currentId: rootId }
}

/** 남은 발자국이 전부 부모까지 이어지는지 */
function isConnected(state: JourneyState): boolean {
  const ids = new Set(state.occurrences.map((o) => o.id))
  return state.occurrences.every((o) => o.parentId === null || ids.has(o.parentId))
}

describe('pruneJourney', () => {
  it('leaves a small journey alone', () => {
    const s = chain(5)
    expect(pruneJourney(s)).toBe(s)
  })

  it('cuts down to the cap', () => {
    const s = fan(60)
    const out = pruneJourney(s, 20)
    expect(out.occurrences.length).toBeLessThanOrEqual(20)
  })

  /**
   * 부모가 사라진 발자국이 남으면 미니맵이 끊어진 가지를 그린다.
   * 자르는 규칙이 지켜야 할 유일한 불변식이다.
   */
  it('never orphans anything', () => {
    for (const s of [fan(60), chain(60)]) {
      for (const max of [5, 12, 30]) {
        const out = pruneJourney(s, max)
        expect(isConnected(out)).toBe(true)
      }
    }
  })

  /** 지금 서 있는 자리의 줄기는 무조건 남는다. 여기가 끊기면 그 화면이 깨진다 */
  it('keeps the whole trail to where you are standing', () => {
    const s = chain(60)
    const out = pruneJourney(s, 10)

    expect(out.currentId).toBe(s.currentId)
    expect(out.occurrences.some((o) => o.id === s.currentId)).toBe(true)

    // 줄기를 끝까지 거슬러 올라갈 수 있어야 한다
    const byId = new Map(out.occurrences.map((o) => [o.id, o]))
    let cursor = out.currentId
    let steps = 0
    while (cursor) {
      const o = byId.get(cursor)
      expect(o).toBeDefined()
      cursor = o!.parentId
      steps += 1
    }
    expect(steps).toBe(out.occurrences.length)
  })

  /** 부모가 자식보다 앞이라는 전제를 스냅샷과 미니맵이 쓴다 */
  it('preserves the original order', () => {
    const out = pruneJourney(fan(60), 20)
    const seen = new Set<string>()
    for (const o of out.occurrences) {
      if (o.parentId !== null) expect(seen.has(o.parentId)).toBe(true)
      seen.add(o.id)
    }
  })

  it('has a cap that is not absurd', () => {
    expect(MAX_OCCURRENCES).toBeGreaterThan(100)
  })
})

describe('loadJourney / saveJourney', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips through storage', () => {
    const s = chain(4)
    expect(saveJourney(s)).toBe(true)
    expect(loadJourney()).toEqual(s)
  })

  it('reads nothing when nothing was written', () => {
    expect(loadJourney()).toBeNull()
  })

  it('does not write an empty journey', () => {
    expect(saveJourney({ occurrences: [], currentId: null })).toBe(false)
    expect(store.size).toBe(0)
  })

  /**
   * 사파리 프라이빗 모드는 setItem에서 던진다. 여기서 예외가 새어 나가면
   * 읽기 뷰가 통째로 죽는다 — 저장이 안 되는 것보다 훨씬 나쁘다.
   */
  it('gives up quietly when storage refuses', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    })

    expect(() => saveJourney(chain(4))).not.toThrow()
    expect(saveJourney(chain(4))).toBe(false)
  })

  /** 저장소 접근 자체가 막힌 브라우저가 있다. 여정 없이 시작한다 */
  it('starts fresh when reading throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {},
      removeItem: () => {},
    })

    expect(loadJourney()).toBeNull()
  })

  /**
   * 한 번 넘치면 줄여서 다시 쓴다. 통째로 포기하면 그 뒤로 영영 저장이 안 된다.
   */
  it('retries smaller when the first write is too big', () => {
    let calls = 0
    const written: string[] = []

    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: (_k: string, v: string) => {
        calls += 1
        if (calls === 1) throw new Error('QuotaExceededError')
        written.push(v)
      },
      removeItem: () => {},
    })

    const big = fan(300)
    expect(saveJourney(big)).toBe(true)
    expect(calls).toBe(2)

    const saved = JSON.parse(written[0]) as JourneyState
    expect(saved.occurrences.length).toBeLessThan(big.occurrences.length)
  })

  it('ignores junk left in storage', () => {
    store.set(JOURNEY_STORAGE_KEY, '{ not json')
    expect(loadJourney()).toBeNull()
  })

  it('ignores a payload from an older schema', () => {
    store.set(JOURNEY_STORAGE_KEY, JSON.stringify({ version: 0, occurrences: [] }))
    expect(loadJourney()).toBeNull()
  })

  /** 상한을 넘는 여정도 잘려서 저장되고 다시 읽힌다 */
  it('stores an oversized journey in pruned form', () => {
    const big = fan(MAX_OCCURRENCES + 120)
    expect(saveJourney(big)).toBe(true)

    const back = loadJourney()
    expect(back).not.toBeNull()
    expect(back!.occurrences.length).toBeLessThanOrEqual(MAX_OCCURRENCES)
    expect(isConnected(back!)).toBe(true)
  })

  it('writes what serializeJourney produces', () => {
    const s = chain(3)
    saveJourney(s)
    expect(store.get(JOURNEY_STORAGE_KEY)).toBe(serializeJourney(s))
  })
})
