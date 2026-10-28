import { loadJourney, saveJourney } from '@/lib/journey/storage'
import { mergeJourney, sanitizeForest } from '@/lib/journey/merge'
import { EMPTY_JOURNEY, type JourneyState, type Occurrence } from '@/lib/journey/types'
import { loadStreak, saveStreak } from '@/lib/streak/client'
import { mergeStreak } from '@/lib/streak/merge'
import type { WireJourney } from '@/lib/journey/wire'

/**
 * Merge the device journey/streak once per tab owner (C4), without throwing.
 * A live run publishes each completed phase to storage and its existing event.
 * Failure/cancellation leaves the completion marker unset for retry; a previously
 * committed phase is not rolled back. Late responses cannot publish after the
 * run is invalidated. Local edits made during a request join the final merge.
 */

/** sessionStorage 마커 — 값은 마지막으로 동기화한 userId. 탭 세션당 1회. */
export const SYNC_MARKER_KEY = 'csqt.sync.v1'

/** 여정 병합이 끝났을 때. detail = 병합된 JourneyState */
export const JOURNEY_SYNCED_EVENT = 'csqt:journey-synced'
/** 잔디 병합이 끝났을 때. detail 없음 — 받는 쪽이 localStorage를 다시 읽는다 */
export const STREAK_SYNCED_EVENT = 'csqt:streak-synced'

export type UserSyncHandle = {
  done: Promise<boolean>
  cancel: () => void
}
type UserSyncRun = UserSyncHandle & {
  userId: string
  controller: AbortController
}
let inflight: UserSyncRun | null = null

function isCurrent(run: UserSyncRun): boolean {
  return inflight === run && !run.controller.signal.aborted
}

/** 시험 전용 — 모듈 상태를 되돌린다 */
export function __resetSyncForTests(): void {
  inflight?.cancel()
}

/** Same-owner calls share work; a new owner invalidates the previous run. */
export function syncForUser(userId: string): Promise<boolean> {
  return startSyncForUser(userId).done
}

/** The disposer belongs to this run, so a stale cleanup cannot cancel a new one. */
export function startSyncForUser(userId: string): UserSyncHandle {
  if (inflight?.userId === userId && isCurrent(inflight)) return inflight
  inflight?.cancel()
  const job: UserSyncRun = {
    userId,
    controller: new AbortController(),
    done: Promise.resolve(false),
    cancel() {
      job.controller.abort()
      if (inflight === job) inflight = null
    },
  }
  inflight = job
  job.done = run(job)
    .catch(() => false)
    .finally(() => {
      if (inflight === job) inflight = null
    })
  return job
}

async function run(job: UserSyncRun): Promise<boolean> {
  if (!isCurrent(job)) return false
  try {
    if (window.sessionStorage.getItem(SYNC_MARKER_KEY) === job.userId) return true
  } catch {
    // sessionStorage가 없으면(프라이빗 모드 일부) 매번 병합한다 — 멱등이라 안전
  }

  const journeyOk = await syncJourney(job)
  if (!journeyOk || !isCurrent(job)) return false

  const streakOk = await syncStreak(job)
  if (!streakOk || !isCurrent(job)) return false

  try {
    window.sessionStorage.setItem(SYNC_MARKER_KEY, job.userId)
  } catch {
    /* 마커를 못 남기면 다음에 또 병합할 뿐이다 */
  }
  return true
}

async function syncJourney(job: UserSyncRun): Promise<boolean> {
  if (!isCurrent(job)) return false
  /*
   * 보내기 전에 정화한다. 옛 버전이 저장한 여정에는 미아 부모·중복 id가
   * 남아 있을 수 있고, 서버는 그런 forest를 400으로 거부한다 — 정화 없이는
   * 그 사용자만 동기화가 영영 실패한다 (실제 운영에서 관찰된 사례).
   */
  const local = sanitizeForest(loadJourney() ?? EMPTY_JOURNEY)

  let res: Response
  try {
    if (local.occurrences.length > 0) {
      // 병합 응답이 전체 세트라 GET이 따로 필요 없다 — 왕복 하나
      res = await fetch('/api/journey/merge', {
        signal: job.controller.signal,
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
      res = await fetch('/api/journey', { signal: job.controller.signal })
    }
  } catch {
    return false
  }
  if (!res.ok || !isCurrent(job)) return false

  let wire: WireJourney
  try {
    wire = (await res.json()) as WireJourney
  } catch {
    return false
  }
  if (!isCurrent(job)) return false

  const server: Occurrence[] = wire.occurrences.map((o) => ({
    id: o.id,
    nodeId: o.node_id,
    parentId: o.parent_id,
    question: o.question,
    category: o.category,
  }))

  // The user may have read more nodes while this request was pending.
  const latest = sanitizeForest(loadJourney() ?? local)
  const merged: JourneyState = mergeJourney(latest, server, wire.current_id)
  saveJourney(merged)
  window.dispatchEvent(new CustomEvent(JOURNEY_SYNCED_EVENT, { detail: merged }))
  return true
}

async function syncStreak(job: UserSyncRun): Promise<boolean> {
  if (!isCurrent(job)) return false
  const local = loadStreak()

  let res: Response
  try {
    res = await fetch('/api/streak/merge', {
      signal: job.controller.signal,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: local.days }),
    })
  } catch {
    return false
  }
  if (!res.ok || !isCurrent(job)) return false

  let wire: { days: Record<string, string[]> }
  try {
    wire = (await res.json()) as { days: Record<string, string[]> }
  } catch {
    return false
  }
  if (!isCurrent(job)) return false

  saveStreak(mergeStreak(mergeStreak(local, loadStreak()), { days: wire.days }))
  window.dispatchEvent(new CustomEvent(STREAK_SYNCED_EVENT))
  return true
}
