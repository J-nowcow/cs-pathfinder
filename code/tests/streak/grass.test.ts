import { describe, it, expect } from 'vitest'
import { grassWeeks, grassSummary, levelOf } from '@/lib/streak/grass'
import { emptyStreak, recordRead } from '@/lib/streak/storage'

/* 2026-08-08은 토요일이다 */
const TODAY = '2026-08-08'

describe('잔디 격자', () => {
  it('주마다 일곱 칸이다', () => {
    const weeks = grassWeeks(emptyStreak(), TODAY, 4)
    expect(weeks.length).toBe(4)
    for (const w of weeks) expect(w.length).toBe(7)
  })

  it('마지막 칸이 오늘이다', () => {
    const weeks = grassWeeks(emptyStreak(), TODAY, 4)
    const last = weeks[weeks.length - 1].filter((c) => c !== null)
    expect(last[last.length - 1]!.day).toBe(TODAY)
  })

  /*
   * 아직 오지 않은 날을 빈 잔디로 그리면 오늘 아무것도 안 한 것처럼 보인다.
   * 수요일에 열면 목·금·토가 회색으로 남는다.
   */
  it('내일부터는 칸을 만들지 않는다', () => {
    /* 2026-08-05는 수요일 */
    const weeks = grassWeeks(emptyStreak(), '2026-08-05', 3)
    const lastWeek = weeks[weeks.length - 1]
    expect(lastWeek.filter((c) => c === null).length).toBe(3)
    expect(lastWeek[3]!.day).toBe('2026-08-05')
  })

  it('판 날은 센 만큼 진하다', () => {
    let s = emptyStreak()
    for (const id of ['a', 'b', 'c', 'd']) s = recordRead(s, '2026-08-06', id)
    const cell = grassWeeks(s, TODAY, 2)
      .flat()
      .find((c) => c?.day === '2026-08-06')
    expect(cell!.count).toBe(4)
    expect(cell!.level).toBe(3)
  })

  it('한 편이면 제일 옅은 칸이 아니라 1단계다', () => {
    expect(levelOf(0)).toBe(0)
    expect(levelOf(1)).toBe(1)
    expect(levelOf(7)).toBe(4)
  })
})

describe('낭독기가 읽을 문장', () => {
  /* 그림만으로 뜻이 전해지면 안 된다. 잔디는 색이 전부라 특히 그렇다 */
  it('며칠에 몇 편인지 말로 적는다', () => {
    let s = emptyStreak()
    s = recordRead(s, '2026-08-06', 'a')
    s = recordRead(s, '2026-08-07', 'b')
    s = recordRead(s, '2026-08-07', 'c')
    const text = grassSummary(grassWeeks(s, TODAY, 4))
    expect(text).toContain('2일')
    expect(text).toContain('3개')
    expect(text).toContain('2026-08-07')
  })

  it('아무것도 없으면 없다고 말한다', () => {
    expect(grassSummary(grassWeeks(emptyStreak(), TODAY, 4))).toBe('아직 열어 본 질문이 없다.')
  })
})
