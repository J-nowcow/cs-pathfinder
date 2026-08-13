export const ANSWER_PRACTICE_STORAGE_KEY = 'csqt.answer-practice.v1'
export const MAX_ANSWER_LENGTH = 6000
export const MAX_ANSWER_DRAFTS = 100

export type AnswerReviewStatus = 'needs-review' | 'understood'
export type AnswerDraft = {
  text: string
  updatedAt: string
  reviewStatus?: AnswerReviewStatus
  reviewedAt?: string
}
export type AnswerPracticeState = {
  alwaysOpen: boolean
  drafts: Record<string, AnswerDraft>
}

export function emptyAnswerPractice(): AnswerPracticeState {
  return { alwaysOpen: false, drafts: {} }
}

/** localStorage는 사용자가 고칠 수 있으므로 유효한 초안만 살려 읽는다. */
export function deserializeAnswerPractice(raw: string | null): AnswerPracticeState {
  if (!raw) return emptyAnswerPractice()
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.version !== 1 || typeof parsed.drafts !== 'object' || !parsed.drafts) {
      return emptyAnswerPractice()
    }

    const drafts: Record<string, AnswerDraft> = {}
    for (const [nodeId, value] of Object.entries(parsed.drafts as Record<string, unknown>)) {
      if (!nodeId || nodeId.length > 200 || typeof value !== 'object' || !value) continue
      const draft = value as Record<string, unknown>
      if (typeof draft.text !== 'string' || typeof draft.updatedAt !== 'string') continue
      drafts[nodeId] = {
        text: draft.text.slice(0, MAX_ANSWER_LENGTH),
        updatedAt: draft.updatedAt,
        ...(draft.reviewStatus === 'needs-review' || draft.reviewStatus === 'understood'
          ? { reviewStatus: draft.reviewStatus }
          : {}),
        ...(typeof draft.reviewedAt === 'string' ? { reviewedAt: draft.reviewedAt } : {}),
      }
    }
    const recent = Object.entries(drafts)
      .sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_ANSWER_DRAFTS)
    return { alwaysOpen: parsed.alwaysOpen === true, drafts: Object.fromEntries(recent) }
  } catch {
    return emptyAnswerPractice()
  }
}

export function serializeAnswerPractice(state: AnswerPracticeState): string {
  return JSON.stringify({ version: 1, ...state })
}

/** 최근 초안만 남긴다. 빈 답은 삭제로 취급한다. */
export function updateAnswerDraft(
  state: AnswerPracticeState,
  nodeId: string,
  text: string,
  updatedAt: string,
): AnswerPracticeState {
  if (!nodeId) return state
  const drafts = { ...state.drafts }
  const trimmed = text.slice(0, MAX_ANSWER_LENGTH)
  if (trimmed.trim()) drafts[nodeId] = { text: trimmed, updatedAt }
  else delete drafts[nodeId]

  const recent = Object.entries(drafts)
    .sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_ANSWER_DRAFTS)
  return { ...state, drafts: Object.fromEntries(recent) }
}

/** 모범답안과 비교한 뒤 남기는 자기 점검. 점수나 AI 평가는 저장하지 않는다. */
export function markAnswerReview(
  state: AnswerPracticeState,
  nodeId: string,
  reviewStatus: AnswerReviewStatus,
  reviewedAt: string,
): AnswerPracticeState {
  const draft = state.drafts[nodeId]
  if (!draft) return state
  return {
    ...state,
    drafts: {
      ...state.drafts,
      [nodeId]: { ...draft, reviewStatus, reviewedAt },
    },
  }
}

export function loadAnswerPractice(): AnswerPracticeState {
  try {
    return deserializeAnswerPractice(window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY))
  } catch {
    return emptyAnswerPractice()
  }
}

export function saveAnswerPractice(state: AnswerPracticeState): boolean {
  try {
    window.localStorage.setItem(ANSWER_PRACTICE_STORAGE_KEY, serializeAnswerPractice(state))
    return true
  } catch {
    return false
  }
}
