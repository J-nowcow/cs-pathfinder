import {
  STREAK_STORAGE_KEY,
  deserializeStreak,
  serializeStreak,
  emptyStreak,
  type StreakState,
} from '@/lib/streak/storage'

/**
 * 브라우저 저장소에 붙는 얇은 껍데기.
 *
 * 계산은 `storage.ts`가 순수 함수로 하고 여기서는 읽고 쓰기만 한다. 그래야
 * 잔디 계산을 브라우저 없이 시험할 수 있다.
 *
 * **어디서도 던지지 않는다.** 사파리 프라이빗 모드는 읽기에서도 던지고,
 * 저장 한도를 넘으면 쓰기에서 던진다. 잔디 하나 때문에 읽던 페이지가 죽는
 * 것은 말이 안 된다. 못 쓰면 그냥 안 남는다.
 */
export function loadStreak(): StreakState {
  try {
    return deserializeStreak(window.localStorage.getItem(STREAK_STORAGE_KEY))
  } catch {
    return emptyStreak()
  }
}

export function saveStreak(state: StreakState): void {
  try {
    window.localStorage.setItem(STREAK_STORAGE_KEY, serializeStreak(state))
  } catch {
    /* 못 쓰면 이번 기록은 없는 것으로 한다 */
  }
}

/** 사용자가 보는 "오늘". 오늘의 질문과 같은 기준이어야 한다 */
export function todayKst(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
