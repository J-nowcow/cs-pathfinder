import { describe, it, expect } from 'vitest'
import { kstToday, kstDateKey } from '@/lib/daily/date'

describe('kstToday', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(kstToday(new Date('2026-08-06T02:00:00Z'))).toBe('2026-08-06')
  })

  it('keeps the same day when UTC morning maps to KST afternoon', () => {
    // UTC 00:30 → KST 09:30 같은 날
    expect(kstToday(new Date('2026-08-06T00:30:00Z'))).toBe('2026-08-06')
  })

  it('rolls over at KST midnight, not UTC midnight', () => {
    // UTC 14:59 → KST 23:59 (같은 날)
    expect(kstToday(new Date('2026-08-06T14:59:00Z'))).toBe('2026-08-06')
    // UTC 15:00 → KST 다음 날 00:00
    expect(kstToday(new Date('2026-08-06T15:00:00Z'))).toBe('2026-08-07')
  })

  it('handles the cron slot (UTC 23:07 = KST 08:07 next day)', () => {
    // 워크플로가 이 시각에 돈다. 발행일이 KST 기준 다음 날이어야 한다
    expect(kstToday(new Date('2026-08-06T23:07:00Z'))).toBe('2026-08-07')
  })

  it('crosses a month boundary', () => {
    expect(kstToday(new Date('2026-08-31T15:00:00Z'))).toBe('2026-09-01')
  })
})

describe('kstDateKey', () => {
  it('packs the date into an int for the advisory lock', () => {
    expect(kstDateKey('2026-08-06')).toBe(20260806)
  })

  it('stays inside int4 so postgres accepts it', () => {
    expect(kstDateKey('2099-12-31')).toBeLessThan(2_147_483_647)
  })

  it('gives a different key to a different day', () => {
    expect(kstDateKey('2026-08-06')).not.toBe(kstDateKey('2026-08-07'))
  })

  it('rejects a malformed date', () => {
    expect(() => kstDateKey('2026-8-6')).toThrow()
  })
})
