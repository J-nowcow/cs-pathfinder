import { loadJourney, saveJourney } from '@/lib/journey/storage'
import { mergeJourney } from '@/lib/journey/merge'
import { EMPTY_JOURNEY, type JourneyState, type Occurrence } from '@/lib/journey/types'
import { loadStreak, saveStreak } from '@/lib/streak/client'
import { mergeStreak } from '@/lib/streak/merge'

/**
 * 로그인 직후 한 번, 이 기기의 기록과 계정의 기록을 합친다 (C4).
 *
 * **절대 던지지 않고, 실패하면 아무것도 안 바꾼다.** 로컬은 사용자가
 * 실제로 판 기록이다 — 동기화가 실패했다고 그것이 다치면 안 된다.
 * 성공했을 때만 마커를 남기므로 실패는 다음 기회에 저절로 재시도된다.
 *
 * 병합 결과는 localStorage에 쓰고 **이벤트로도 알린다.** localStorage만
 * 고치면 이미 떠 있는 ReadingView의 저장 훅이 메모리의 옛 상태로 도로
 * 덮는다 — 지난 버그("빈 상태가 진짜 데이터를 덮는다")와 같은 모양이다.
 * 서버 데이터는 화면의 메모리 상태를 통과해야 안전하다.
 */

/** sessionStorage 마커 — 값은 마지막으로 동기화한 userId. 탭 세션당 1회. */
export const SYNC_MARKER_KEY = 'csqt.sync.v1'

/** 여정 병합이 끝났을 때. detail = 병합된 JourneyState */
export const JOURNEY_SYNCED_EVENT = 'csqt:journey-synced'
/** 잔디 병합이 끝났을 때. detail 없음 — 받는 쪽이 localStorage를 다시 읽는다 */
export const STREAK_SYNCED_EVENT = 'csqt:streak-synced'

let inflight: Promise<boolean> | null = null

/** 시험 전용 — 모듈 상태를 되돌린다 */
export function __resetSyncForTests(): void {
  inflight = null
}

/**
 * 같은 탭에서 겹쳐 불려도 한 번만 돈다 (getDb의 약속 캐싱과 같은 패턴).
 * 완료 후에는 다시 부를 수 있다 — 실패했다면 재시도가 되는 것이 맞다.
 */
export function syncForUser(userId: string): Promise<boolean> {
  if (!inflight) {
    inflight = run(userId)
      .catch(() => false)
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

async function run(userId: string): Promise<boolean> {
  try {
    if (window.sessionStorage.getItem(SYNC_MARKER_KEY) === userId) return true
  } catch {
    // sessionStorage가 없으면(프라이빗 모드 일부) 매번 병합한다 — 멱등이라 안전
  }

  const journeyOk = await syncJourney()
  if (!journeyOk) return false

  const streakOk = await syncStreak()
  if (!streakOk) return false

  try {
    window.sessionStorage.setItem(SYNC_MARKER_KEY, userId)
  } catch {
    /* 마커를 못 남기면 다음에 또 병합할 뿐이다 */
  }
  return true
}

type WireOccurrence = {
  id: string
  node_id: string
  parent_id: string | null
  question: string
  category: string
}
type WireJourney = { occurrences: WireOccurrence[]; current_id: string | null }

async function syncJourney(): Promise<boolean> {
  const local = loadJourney() ?? EMPTY_JOURNEY

  let res: Response
  try {
    if (local.occurrences.length > 0) {
      // 병합 응답이 전체 세트라 GET이 따로 필요 없다 — 왕복 하나
      res = await fetch('/api/journey/merge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // 구조만 보낸다. 문장은 서버가 qnode에서 다시 읽는다 (share와 같은 규약)
          occurrences: local.occurrences.map((o) => ({
            id: o.id,
            node_id: o.nodeId,
            parent_id: o.parentId,
          })),
          current_id: local.currentId,
        }),
      })
    } else {
      res = await fetch('/api/journey')
    }
  } catch {
    return false
  }
  if (!res.ok) return false

  let wire: WireJourney
  try {
    wire = (await res.json()) as WireJourney
  } catch {
    return false
  }

  const server: Occurrence[] = wire.occurrences.map((o) => ({
    id: o.id,
    nodeId: o.node_id,
    parentId: o.parent_id,
    question: o.question,
    category: o.category,
  }))

  const merged: JourneyState = mergeJourney(local, server, wire.current_id)
  saveJourney(merged)
  window.dispatchEvent(new CustomEvent(JOURNEY_SYNCED_EVENT, { detail: merged }))
  return true
}

async function syncStreak(): Promise<boolean> {
  const local = loadStreak()

  let res: Response
  try {
    res = await fetch('/api/streak/merge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: local.days }),
    })
  } catch {
    return false
  }
  if (!res.ok) return false

  let wire: { days: Record<string, string[]> }
  try {
    wire = (await res.json()) as { days: Record<string, string[]> }
  } catch {
    return false
  }

  saveStreak(mergeStreak(local, { days: wire.days }))
  window.dispatchEvent(new CustomEvent(STREAK_SYNCED_EVENT))
  return true
}
