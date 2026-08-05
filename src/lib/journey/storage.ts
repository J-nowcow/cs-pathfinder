import type { JourneyState, Occurrence } from '@/lib/journey/types'

export const JOURNEY_STORAGE_KEY = 'csqt.journey.v1'

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
