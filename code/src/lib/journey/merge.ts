import { pathTo } from '@/lib/journey/path'
import type { JourneyState, Occurrence } from '@/lib/journey/types'

/**
 * 두 기기의 여정을 하나로 — 병합 규칙(auth-design §2).
 *
 * ① 더하기만. 어느 쪽도 지워지지 않는다. 지난 버그("빈 상태가 진짜
 *    데이터를 덮는다")가 이 층에서 재발하면 서버까지 오염되므로,
 *    치환 코드는 아예 만들지 않는다.
 * ② currentId는 로컬 우선. 로컬은 방금 한 것이고 서버는 다른 기기에서
 *    예전에 한 것이다.
 * ③ 결과는 항상 이어진 숲. 부모가 자식보다 앞 — graph.ts와
 *    storage.ts가 이 전제를 쓴다.
 *
 * 발자국의 정체성은 pathKey다. occurrence id는 브라우저가 만들어
 * 기기마다 다르므로 id로는 합칠 수 없다.
 */

/** 뿌리부터 이 발자국까지의 nodeId 사슬. pathTo가 순환도 끊는다. */
export function pathKeyOf(state: JourneyState, occurrenceId: string): string {
  return pathTo(state, occurrenceId)
    .map((o) => o.nodeId)
    .join('>')
}

/**
 * 서버에 보내기 전에 손상을 고친다.
 *
 * 옛 버전이 저장한 여정에는 부모가 잘려 나간 발자국·중복 id가 남아 있을 수
 * 있다. 서버는 그런 forest를 거부하므로(invalid_forest 400) 고치지 않으면
 * **그 사용자는 동기화가 영영 안 된다** — 실제 운영에서 관찰된 사례다.
 *
 * 규칙은 하나다: **앞서 등장한 발자국만 부모로 인정한다.** 저장 불변식
 * ("부모가 자식보다 앞")과 같은 기준이라, 미아 부모·순서 위반·순환이
 * 전부 한 규칙으로 정리되고 결과는 항상 유효한 숲이다. 지우지 않고
 * 뿌리로 승격한다 — enterAsRoot와 같은 판단이다. 숲이어도 된다.
 */
export function sanitizeForest(state: JourneyState): JourneyState {
  const seen = new Set<string>()
  const out: Occurrence[] = []
  let changed = false

  for (const o of state.occurrences) {
    if (seen.has(o.id)) {
      changed = true
      continue
    }
    // 자기 id를 등록하기 **전에** 부모를 검사한다 — 자기참조(o.parentId === o.id)도
    // "앞서 등장한 부모가 아니다"로 걸려 뿌리로 승격된다
    const parentOk = o.parentId === null || seen.has(o.parentId)
    seen.add(o.id)
    if (!parentOk) {
      changed = true
      out.push({ ...o, parentId: null })
    } else {
      out.push(o)
    }
  }

  if (!changed) return state
  const currentId = state.currentId && seen.has(state.currentId) ? state.currentId : null
  return { occurrences: out, currentId }
}

/**
 * 서버 세트(position 순 = 부모 선행)를 먼저 깔고, 로컬 전용만 뒤에 잇는다.
 *
 * 같은 키가 양쪽에 있으면 **서버 id를 남긴다** — 다음 동기화 때 같은
 * 행으로 다시 접히므로 id가 흔들리지 않는다. 로컬 전용 발자국의 부모가
 * 공유 키였다면 그 부모는 서버 id로 바뀌었으므로 재매핑한다.
 *
 * 부모 선행 증명: 서버 블록은 position 순으로 자체 선행이고, 로컬 전용
 * 행의 부모는 공유 키(서버 블록에 있음)거나 로컬 전용(로컬 배열 순서가
 * 선행 보장)이다. 따라서 "서버 전체 → 로컬 전용" 연접만으로 성립한다.
 */
export function mergeJourney(
  local: JourneyState,
  server: Occurrence[],
  serverCurrentId: string | null,
): JourneyState {
  const serverState: JourneyState = { occurrences: server, currentId: null }
  const idByKey = new Map<string, string>()
  const out: Occurrence[] = []

  for (const s of server) {
    idByKey.set(pathKeyOf(serverState, s.id), s.id)
    out.push(s)
  }

  for (const l of local.occurrences) {
    const key = pathKeyOf(local, l.id)
    if (idByKey.has(key)) continue
    const parentId =
      l.parentId === null
        ? null
        : // 부모가 손상돼 못 찾으면 뿌리로 승격 — 잘린 가지가 미아보다 낫다
          (idByKey.get(pathKeyOf(local, l.parentId)) ?? null)
    idByKey.set(key, l.id)
    out.push({ ...l, parentId })
  }

  let currentId: string | null = null
  if (local.currentId) {
    // 로컬 자리가 공유 키로 접혔으면 그 서버 id를 가리킨다
    currentId = idByKey.get(pathKeyOf(local, local.currentId)) ?? null
  }
  if (!currentId && serverCurrentId && out.some((o) => o.id === serverCurrentId)) {
    currentId = serverCurrentId
  }
  if (!currentId) currentId = out[0]?.id ?? null

  return { occurrences: out, currentId }
}
