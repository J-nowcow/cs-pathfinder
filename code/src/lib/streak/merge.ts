import { MAX_DAYS, MAX_PER_DAY, type StreakState } from '@/lib/streak/storage'

/**
 * 두 기기의 잔디를 하나로 — 날짜별 합집합.
 *
 * 잔디는 이력이라 지우는 경로가 없다. 다만 결과가 localStorage로
 * 돌아가므로 클라이언트 상한을 지킨다 — 상한은 용량이 아니라
 * "저장이 실패하는 날이 반드시 오기 때문"이다(storage.ts).
 * 서버는 전체를 들고, 로컬은 최근 창만 본다.
 */
export function mergeStreak(local: StreakState, server: StreakState): StreakState {
  const days: Record<string, string[]> = {}

  const allDates = new Set([...Object.keys(local.days), ...Object.keys(server.days)])
  for (const date of allDates) {
    const merged = [...(server.days[date] ?? [])]
    const seen = new Set(merged)
    for (const id of local.days[date] ?? []) {
      if (!seen.has(id)) {
        seen.add(id)
        merged.push(id)
      }
    }
    days[date] = merged.slice(0, MAX_PER_DAY)
  }

  // ISO 날짜라 문자열 정렬이 곧 시간순 — 오래된 날부터 버린다 (recordRead와 같은 규칙)
  const keys = Object.keys(days).sort()
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_DAYS))) delete days[k]

  return { days }
}
