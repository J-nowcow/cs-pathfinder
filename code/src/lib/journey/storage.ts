import type { JourneyState, Occurrence } from '@/lib/journey/types'

export const JOURNEY_STORAGE_KEY = 'csqt.journey.v1'

/**
 * 발자국 상한.
 *
 * 이 숫자가 용량 때문에 있는 것은 아니다. 발자국 하나가 200바이트쯤이라
 * 400개라야 80KB고 localStorage 한도는 그 60배쯤 된다.
 *
 * 상한이 필요한 이유는 저장이 실패하는 날이 반드시 오기 때문이다. 사파리
 * 프라이빗 모드는 예전부터 setItem에서 던졌고, 한도는 브라우저마다 다르다.
 * 무한히 늘어나는 값을 매번 통째로 쓰면 언제 넘는지 아무도 모른다.
 */
export const MAX_OCCURRENCES = 400

/**
 * 스키마 버전.
 *
 * occurrence 모양이 바뀌면 올린다. 옛 데이터를 억지로 읽으면 미니맵이
 * 깨진 좌표로 그려지고 원인을 추적하기 어렵다. 버리는 편이 낫다.
 */
const SCHEMA_VERSION = 1

export function serializeJourney(state: JourneyState): string {
  return JSON.stringify({ version: SCHEMA_VERSION, ...state })
}

function isOccurrence(v: unknown): v is Occurrence {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.nodeId === 'string' &&
    (o.parentId === null || typeof o.parentId === 'string') &&
    typeof o.question === 'string' &&
    typeof o.category === 'string'
  )
}

/**
 * 저장된 경로를 읽는다. 실패하면 null이다.
 *
 * 예외를 던지지 않는다. sessionStorage 내용은 사용자가 언제든 손댈 수 있고
 * 여기서 던지면 읽기 뷰가 통째로 죽는다. 여정을 새로 시작하는 편이 낫다.
 */
export function deserializeJourney(raw: string | null): JourneyState | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const p = parsed as Record<string, unknown>

  if (p.version !== SCHEMA_VERSION) return null
  if (!Array.isArray(p.occurrences)) return null
  if (!p.occurrences.every(isOccurrence)) return null

  const occurrences = p.occurrences as Occurrence[]
  const currentId = typeof p.currentId === 'string' ? p.currentId : null

  // 가리키는 발자국이 사라졌으면 첫 발자국으로 되돌린다. null로 두면
  // 화면이 현재 위치 없이 렌더되고 그 분기를 모든 컴포넌트가 떠안는다.
  const valid = currentId && occurrences.some((o) => o.id === currentId)

  return {
    occurrences,
    currentId: valid ? currentId : (occurrences[0]?.id ?? null),
  }
}

/**
 * 상한을 넘으면 자른다.
 *
 * 아무거나 버리면 안 된다. 부모가 사라진 발자국은 미아가 되고 미니맵이
 * 끊어진 가지를 그린다. 그래서 남길 것을 고르는 순서를 정했다.
 *
 * 1. 지금 서 있는 자리에서 뿌리까지의 줄기. 이건 무조건 남는다. 화면이
 *    지금 이 경로를 그리고 있어서 여기가 끊기면 그 자리에서 깨진다.
 * 2. 나머지는 최근에 판 것부터. 단 부모가 이미 남은 것만 받는다.
 *
 * 2번을 부모가 남았는지 보면서 넣기 때문에 결과는 항상 이어진 나무다.
 */
export function pruneJourney(state: JourneyState, max = MAX_OCCURRENCES): JourneyState {
  if (state.occurrences.length <= max) return state

  const byId = new Map(state.occurrences.map((o) => [o.id, o]))
  const kept = new Set<string>()

  // 1. 현재 줄기
  let cursor = state.currentId
  while (cursor) {
    const o = byId.get(cursor)
    if (!o || kept.has(o.id)) break
    kept.add(o.id)
    cursor = o.parentId
  }

  // 2. 최근 순. 부모가 이미 남은 것만
  for (let i = state.occurrences.length - 1; i >= 0 && kept.size < max; i -= 1) {
    const o = state.occurrences[i]
    if (kept.has(o.id)) continue
    if (o.parentId === null || kept.has(o.parentId)) kept.add(o.id)
  }

  // 원래 순서를 지킨다. 부모가 자식보다 앞이라는 전제를 다른 코드가 쓴다
  return {
    occurrences: state.occurrences.filter((o) => kept.has(o.id)),
    currentId: state.currentId,
  }
}

/**
 * 브라우저 저장소 읽고 쓰기.
 *
 * **sessionStorage가 아니라 localStorage다.** 화면은 "파고든 만큼 지도가 남는다"고
 * 말하는데 sessionStorage는 탭을 닫으면 사라진다. 모바일에서는 사파리가
 * 백그라운드로 보낸 탭을 정리하면서 더 일찍 사라지기도 한다. 약속과 다르다.
 *
 * 서버에 안 보낸다. 인증이 없어서 보낼 곳이 없기도 하지만, 익명 사용자의
 * 학습 경로를 서버에 쌓아둘 이유도 없다.
 */
export function loadJourney(): JourneyState | null {
  try {
    return deserializeJourney(localStorage.getItem(JOURNEY_STORAGE_KEY))
  } catch {
    // 저장소 접근 자체가 막힌 브라우저가 있다. 여정 없이 시작한다
    return null
  }
}

/**
 * 저장하고 성공 여부를 돌려준다.
 *
 * 한 번 실패하면 줄여서 다시 시도한다. 그래도 안 되면 포기하고 false다.
 * 여기서 던지면 읽기 뷰가 통째로 죽는다 — 저장이 안 되는 것보다 훨씬 나쁘다.
 * 실패해도 여정은 메모리에 남아서 그 탭에서는 계속 판다.
 */
export function saveJourney(state: JourneyState): boolean {
  if (state.occurrences.length === 0) return false

  const attempts = [pruneJourney(state), pruneJourney(state, 50)]

  for (const attempt of attempts) {
    try {
      localStorage.setItem(JOURNEY_STORAGE_KEY, serializeJourney(attempt))
      return true
    } catch {
      continue
    }
  }

  return false
}
