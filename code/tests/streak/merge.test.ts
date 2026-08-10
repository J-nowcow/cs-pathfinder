import { describe, it, expect } from 'vitest'
import { mergeStreak } from '@/lib/streak/merge'
import { MAX_DAYS, MAX_PER_DAY, shiftDay } from '@/lib/streak/storage'

/**
 * M6 — 잔디 병합. 합집합이고, localStorage에 되쓸 것이므로 클라이언트
 * 상한(MAX_DAYS·MAX_PER_DAY)을 지켜야 한다. 캡을 지우면 400일을 넘긴
 * 사용자의 저장이 도로 실패하기 시작한다 — storage.ts가 상한을 둔 이유
 * 그대로다.
 */
describe('mergeStreak', () => {
  it('양쪽 날짜가 합쳐지고 같은 날 같은 id는 한 번만 남는다', () => {
    const out = mergeStreak(
      { days: { '2026-08-01': ['a', 'b'] } },
      { days: { '2026-08-01': ['b', 'c'], '2026-08-02': ['d'] } },
    )
    expect(out.days['2026-08-01'].sort()).toEqual(['a', 'b', 'c'])
    expect(out.days['2026-08-02']).toEqual(['d'])
  })

  it('로컬이 비어도 서버가 비어도 남은 쪽이 그대로 산다', () => {
    expect(mergeStreak({ days: {} }, { days: { '2026-08-01': ['a'] } }).days).toEqual({
      '2026-08-01': ['a'],
    })
    expect(mergeStreak({ days: { '2026-08-01': ['a'] } }, { days: {} }).days).toEqual({
      '2026-08-01': ['a'],
    })
  })

  it('하루 상한을 지킨다', () => {
    const many = Array.from({ length: MAX_PER_DAY + 50 }, (_, i) => `n${i}`)
    const out = mergeStreak({ days: { '2026-08-01': many.slice(0, 10) } }, { days: { '2026-08-01': many } })
    expect(out.days['2026-08-01'].length).toBeLessThanOrEqual(MAX_PER_DAY)
  })

  it('날짜 수 상한을 지키고 오래된 날부터 버린다', () => {
    const days: Record<string, string[]> = {}
    let d = '2020-01-01'
    for (let i = 0; i < MAX_DAYS + 10; i++) {
      days[d] = ['x']
      d = shiftDay(d, 1)
    }
    const out = mergeStreak({ days: {} }, { days })
    const keys = Object.keys(out.days).sort()
    expect(keys.length).toBe(MAX_DAYS)
    // 남은 것 중 가장 오래된 날이, 버려진 날들보다 뒤여야 한다
    expect(keys[0] > '2020-01-01').toBe(true)
  })
})
