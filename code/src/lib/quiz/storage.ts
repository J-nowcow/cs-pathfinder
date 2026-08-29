/**
 * 진단 퀴즈의 클라이언트 저장소.
 *
 * 익명 사용자에게는 이것이 전부이고, 로그인 사용자에게도 1차 저장소다.
 * 서버 병합은 journey·streak과 같은 결로 나중에 붙는다.
 *
 * `answer-practice/storage.ts`와 같은 모양을 쓴다 — 순수 함수로 상태를
 * 바꾸고, load/save만 localStorage를 만진다. 시험이 브라우저 없이 돈다.
 *
 * 설계: `docs/design/2026-08-29-quiz.md`
 */

export const QUIZ_STORAGE_KEY = 'csqt.quiz.v1'

/** 노드 수 상한. localStorage 저장 실패를 막는다 */
export const MAX_QUIZ_NODES = 500

/** 한 노드의 문제 수. 넘어오는 값은 잘라 받는다 */
export const MAX_QUIZ_ITEMS = 8

export type QuizAttempt = {
  /** 문제별로 고른 보기 인덱스. 아직 안 푼 문제는 -1 */
  chosen: number[]
  /** 마지막으로 답한 시각 (ISO) */
  at: string
}

export type QuizState = {
  /** nodeId -> 답한 기록 */
  attempts: Record<string, QuizAttempt>
  /** 건너뛴 노드. 다시 묻지 않는다 */
  skipped: string[]
}

export function emptyQuizState(): QuizState {
  return { attempts: {}, skipped: [] }
}

function validNodeId(nodeId: string): boolean {
  return nodeId.length > 0 && nodeId.length <= 200
}

function readAttempts(raw: unknown): Record<string, QuizAttempt> {
  if (typeof raw !== 'object' || !raw) return {}
  const attempts: Record<string, QuizAttempt> = {}
  for (const [nodeId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!validNodeId(nodeId)) continue
    if (typeof value !== 'object' || !value) continue
    const entry = value as Record<string, unknown>
    if (!Array.isArray(entry.chosen)) continue
    if (typeof entry.at !== 'string') continue
    const chosen = entry.chosen
      .slice(0, MAX_QUIZ_ITEMS)
      .map((n) => (Number.isInteger(n) && (n as number) >= -1 ? (n as number) : -1))
    if (!chosen.length) continue
    attempts[nodeId] = { chosen, at: entry.at }
  }
  return trimAttempts(attempts)
}

function readSkipped(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  for (const value of raw) {
    if (typeof value !== 'string' || !validNodeId(value)) continue
    seen.add(value)
    if (seen.size >= MAX_QUIZ_NODES) break
  }
  return [...seen]
}

/** 최근 것부터 남긴다. 오래된 기록이 밀려나도 다시 풀면 그만이다. */
function trimAttempts(attempts: Record<string, QuizAttempt>): Record<string, QuizAttempt> {
  return Object.fromEntries(
    Object.entries(attempts)
      .sort(([, a], [, b]) => b.at.localeCompare(a.at))
      .slice(0, MAX_QUIZ_NODES),
  )
}

/** localStorage는 사용자가 고칠 수 있으므로 유효한 값만 살려 읽는다. */
export function deserializeQuiz(raw: string | null): QuizState {
  if (!raw) return emptyQuizState()
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.version !== 1) return emptyQuizState()
    return {
      attempts: readAttempts(parsed.attempts),
      skipped: readSkipped(parsed.skipped),
    }
  } catch {
    return emptyQuizState()
  }
}

export function serializeQuiz(state: QuizState): string {
  return JSON.stringify({ version: 1, ...state })
}

/**
 * 한 문제에 답한 것을 기록한다.
 *
 * 다시 풀면 덮어쓴다 — 두 번째 시도가 진짜 이해일 수 있다. DB 쪽
 * `quiz_answer`의 `on conflict do update`와 같은 결정이다.
 */
export function recordChoice(
  state: QuizState,
  nodeId: string,
  itemIndex: number,
  chosen: number,
  itemCount: number,
  at: string,
): QuizState {
  if (!validNodeId(nodeId)) return state
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= itemCount) return state
  if (!Number.isInteger(chosen) || chosen < 0) return state

  const previous = state.attempts[nodeId]?.chosen ?? []
  const next = Array.from({ length: Math.min(itemCount, MAX_QUIZ_ITEMS) }, (_, i) =>
    i === itemIndex ? chosen : (previous[i] ?? -1),
  )

  return {
    ...state,
    attempts: trimAttempts({ ...state.attempts, [nodeId]: { chosen: next, at } }),
  }
}

/** 건너뛰기. 진단을 강제하지 않는 것이 첫인상을 지킨다. */
export function skipQuiz(state: QuizState, nodeId: string): QuizState {
  if (!validNodeId(nodeId)) return state
  if (state.skipped.includes(nodeId)) return state
  return { ...state, skipped: [...state.skipped, nodeId].slice(-MAX_QUIZ_NODES) }
}

/** 이미 답했거나 건너뛴 노드는 다시 묻지 않는다. */
export function shouldAsk(state: QuizState, nodeId: string, itemCount: number): boolean {
  if (itemCount <= 0) return false
  if (state.skipped.includes(nodeId)) return false
  const chosen = state.attempts[nodeId]?.chosen
  if (!chosen) return true
  return chosen.slice(0, itemCount).some((c) => c < 0)
}

export function loadQuiz(): QuizState {
  try {
    return deserializeQuiz(window.localStorage.getItem(QUIZ_STORAGE_KEY))
  } catch {
    return emptyQuizState()
  }
}

export function saveQuiz(state: QuizState): boolean {
  try {
    window.localStorage.setItem(QUIZ_STORAGE_KEY, serializeQuiz(state))
    return true
  } catch {
    return false
  }
}
