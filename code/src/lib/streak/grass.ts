import { shiftDay, type StreakState } from '@/lib/streak/storage'

/**
 * 잔디 격자.
 *
 * 한 칸이 하루다. 세로가 요일이고 가로가 주다 -- 사람들이 아는 그 모양이다.
 * 여기서는 **자료만 만든다.** 그리는 일은 컴포넌트가 한다.
 *
 * 나누는 이유는 시험 때문이다. 격자 계산은 경계에서 틀리기 쉽다(주의 시작,
 * 빈 앞칸, 미래 칸). 화면에 붙어 있으면 그것을 재기 어렵다.
 */
export type Cell = { day: string; count: number; level: 0 | 1 | 2 | 3 | 4 }

/** 요일. 0이 일요일이다 */
function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay()
}

/**
 * 몇 편이면 얼마나 진한가.
 *
 * 사람이 하루에 파는 양은 대개 한 자리다. 그래서 1·2·4를 경계로 둔다.
 * 10편을 기준으로 잡으면 대부분의 날이 제일 옅은 칸으로 뭉개진다.
 */
export function levelOf(count: number): Cell['level'] {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 6) return 3
  return 4
}

/**
 * 오늘까지 `weeks`주를 담은 격자를 만든다.
 *
 * 마지막 열이 이번 주다. 그 열의 남은 요일(내일부터)은 **칸을 만들지 않는다** --
 * 아직 오지 않은 날을 빈 잔디로 그리면 오늘 아무것도 안 한 것처럼 보인다.
 *
 * 돌려주는 것은 주 단위 배열이고, 각 주는 일요일부터 토요일까지 7칸이다.
 * 첫 주의 앞칸은 `null`이다(그 주가 시작되기 전).
 */
export function grassWeeks(
  state: StreakState,
  today: string,
  weeks = 26,
): Array<Array<Cell | null>> {
  const endWeekday = weekdayOf(today)
  /* 첫 칸은 `weeks-1`주 전의 일요일 */
  const start = shiftDay(today, -(endWeekday + (weeks - 1) * 7))

  const out: Array<Array<Cell | null>> = []
  for (let w = 0; w < weeks; w += 1) {
    const week: Array<Cell | null> = []
    for (let d = 0; d < 7; d += 1) {
      const day = shiftDay(start, w * 7 + d)
      if (day > today) {
        week.push(null)
        continue
      }
      const count = state.days[day]?.length ?? 0
      week.push({ day, count, level: levelOf(count) })
    }
    out.push(week)
  }
  return out
}

/** 잔디를 낭독기가 읽을 한 문장으로. 그림만으로 뜻이 전해지면 안 된다 */
export function grassSummary(weeks: Array<Array<Cell | null>>): string {
  const cells = weeks.flat().filter((c): c is Cell => c !== null)
  const active = cells.filter((c) => c.count > 0)
  if (active.length === 0) return '아직 판 날이 없다.'
  const total = active.reduce((n, c) => n + c.count, 0)
  const best = active.reduce((a, b) => (b.count > a.count ? b : a))
  return `최근 ${cells.length}일 가운데 ${active.length}일 팠고 모두 ${total}편이다. 가장 많이 판 날은 ${best.day}로 ${best.count}편이다.`
}
