import { describe, it, expect } from 'vitest'
import {
  deserializeStreak,
  serializeStreak,
  recordRead,
  totalRead,
  distinctRead,
  streakLength,
  shiftDay,
  emptyStreak,
  MAX_DAYS,
  MAX_PER_DAY,
} from '@/lib/streak/storage'

describe('며칠에 몇 편을 팠는지', () => {
  it('같은 질문을 다시 열어도 한 번만 센다', () => {
    let s = emptyStreak()
    s = recordRead(s, '2026-08-08', 'a')
    s = recordRead(s, '2026-08-08', 'a')
    s = recordRead(s, '2026-08-08', 'b')
    expect(totalRead(s)).toBe(2)
  })

  /*
   * 새로고침 한 번에 잔디가 진해지면 그 숫자는 아무 뜻이 없다. 개수만 세는
   * 구조로 되돌리면 이 시험이 깨진다.
   */
  it('바뀐 것이 없으면 같은 객체를 그대로 돌려준다', () => {
    const s = recordRead(emptyStreak(), '2026-08-08', 'a')
    expect(recordRead(s, '2026-08-08', 'a')).toBe(s)
  })

  it('다른 날 다시 보면 그날 몫으로 센다', () => {
    let s = recordRead(emptyStreak(), '2026-08-07', 'a')
    s = recordRead(s, '2026-08-08', 'a')
    expect(totalRead(s)).toBe(2)
    expect(distinctRead(s)).toBe(1)
  })

  it('날짜 모양이 아니면 안 적는다', () => {
    const s = recordRead(emptyStreak(), '8/8', 'a')
    expect(totalRead(s)).toBe(0)
  })

  it('오래된 날부터 버려 상한을 지킨다', () => {
    let s = emptyStreak()
    for (let i = 0; i < MAX_DAYS + 20; i += 1) {
      s = recordRead(s, shiftDay('2020-01-01', i), 'a')
    }
    const days = Object.keys(s.days).sort()
    expect(days.length).toBe(MAX_DAYS)
    /* 남은 것은 최근 쪽이어야 한다 */
    expect(days[days.length - 1]).toBe(shiftDay('2020-01-01', MAX_DAYS + 19))
  })

  it('하루 상한을 넘으면 더 안 센다', () => {
    let s = emptyStreak()
    for (let i = 0; i < MAX_PER_DAY + 5; i += 1) s = recordRead(s, '2026-08-08', `n${i}`)
    expect(s.days['2026-08-08'].length).toBe(MAX_PER_DAY)
  })
})

describe('저장된 것 읽기', () => {
  it('오간 뒤에도 그대로다', () => {
    let s = emptyStreak()
    s = recordRead(s, '2026-08-08', 'a')
    s = recordRead(s, '2026-08-07', 'b')
    expect(deserializeStreak(serializeStreak(s))).toEqual(s)
  })

  /*
   * localStorage 내용은 사용자가 언제든 손댈 수 있다. 여기서 던지면 잔디가
   * 아니라 페이지가 통째로 죽는다.
   */
  it('망가진 값에도 안 던진다', () => {
    for (const raw of [null, '', '{', '[]', '"x"', '{"version":9,"days":{}}']) {
      expect(() => deserializeStreak(raw)).not.toThrow()
      expect(totalRead(deserializeStreak(raw))).toBe(0)
    }
  })

  it('날짜가 아닌 열쇠와 문자열이 아닌 값은 버린다', () => {
    const raw = JSON.stringify({ version: 1, days: { '2026-08-08': ['a', 3, null], 어제: ['b'] } })
    const s = deserializeStreak(raw)
    expect(Object.keys(s.days)).toEqual(['2026-08-08'])
    expect(s.days['2026-08-08']).toEqual(['a'])
  })
})

describe('이어서 판 날수', () => {
  it('오늘까지 이어지면 그만큼 센다', () => {
    let s = emptyStreak()
    for (const d of ['2026-08-06', '2026-08-07', '2026-08-08']) s = recordRead(s, d, 'a')
    expect(streakLength(s, '2026-08-08')).toBe(3)
  })

  /*
   * 아침에 들어왔다고 어제까지의 기록이 0으로 보이면 그건 벌이지 응원이 아니다.
   */
  it('오늘 아직 안 팠어도 어제까지 이어졌으면 살아 있다', () => {
    let s = emptyStreak()
    for (const d of ['2026-08-06', '2026-08-07']) s = recordRead(s, d, 'a')
    expect(streakLength(s, '2026-08-08')).toBe(2)
  })

  it('하루라도 비면 거기서 끊는다', () => {
    let s = emptyStreak()
    for (const d of ['2026-08-05', '2026-08-07', '2026-08-08']) s = recordRead(s, d, 'a')
    expect(streakLength(s, '2026-08-08')).toBe(2)
  })

  it('이틀 넘게 비면 0이다', () => {
    const s = recordRead(emptyStreak(), '2026-08-01', 'a')
    expect(streakLength(s, '2026-08-08')).toBe(0)
  })
})

describe('날짜 옮기기', () => {
  it('달과 해를 넘는다', () => {
    expect(shiftDay('2026-02-28', 1)).toBe('2026-03-01')
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
  })

  /* 2024는 윤년이다. UTC로 계산하지 않으면 시간대에 따라 하루가 밀린다 */
  it('윤년을 안다', () => {
    expect(shiftDay('2024-02-28', 1)).toBe('2024-02-29')
  })
})
