export const RESUME_QUESTIONS_STORAGE_KEY = 'cspf_resume_questions_v1'
export const MAX_RESUME_ANSWER_LENGTH = 6000

export type ResumeQuestion = {
  text: string
  basis: string
  topic: string
}

export type SavedResumeQuestions = {
  version: 1
  createdAt: string
  questions: ResumeQuestion[]
  answers?: Record<string, ResumeAnswer>
}

export type ResumeAnswer = { text: string; updatedAt: string }

function isQuestion(value: unknown): value is ResumeQuestion {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.text === 'string' &&
    item.text.length > 0 &&
    typeof item.basis === 'string' &&
    item.basis.length > 0 &&
    typeof item.topic === 'string' &&
    item.topic.length > 0
  )
}

export function serializeResumeQuestions(
  questions: ResumeQuestion[],
  createdAt = new Date().toISOString(),
  answers: Record<string, ResumeAnswer> = {},
): string {
  return JSON.stringify({
    version: 1,
    createdAt,
    questions,
    ...(Object.keys(answers).length > 0 ? { answers } : {}),
  } satisfies SavedResumeQuestions)
}

export function deserializeResumeQuestions(raw: string | null): SavedResumeQuestions | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    if (
      value.version !== 1 ||
      typeof value.createdAt !== 'string' ||
      !Array.isArray(value.questions) ||
      value.questions.length !== 5 ||
      !value.questions.every(isQuestion)
    ) {
      return null
    }
    if (Number.isNaN(Date.parse(value.createdAt))) return null

    const answers: Record<string, ResumeAnswer> = {}
    if (value.answers && typeof value.answers === 'object') {
      for (const [key, rawAnswer] of Object.entries(value.answers as Record<string, unknown>)) {
        const index = Number(key)
        if (!Number.isInteger(index) || index < 0 || index >= 5) continue
        if (!rawAnswer || typeof rawAnswer !== 'object') continue
        const answer = rawAnswer as Record<string, unknown>
        if (
          typeof answer.text !== 'string' ||
          !answer.text.trim() ||
          typeof answer.updatedAt !== 'string' ||
          Number.isNaN(Date.parse(answer.updatedAt))
        ) continue
        answers[key] = {
          text: answer.text.slice(0, MAX_RESUME_ANSWER_LENGTH),
          updatedAt: answer.updatedAt,
        }
      }
    }

    return {
      version: 1,
      createdAt: value.createdAt,
      questions: value.questions as ResumeQuestion[],
      ...(Object.keys(answers).length > 0 ? { answers } : {}),
    }
  } catch {
    return null
  }
}

/** 맞춤 질문 다섯 개에만 답을 붙인다. 빈 답은 저장소에서 제거한다. */
export function updateResumeAnswer(
  saved: SavedResumeQuestions,
  index: number,
  text: string,
  updatedAt: string,
): SavedResumeQuestions {
  if (!Number.isInteger(index) || index < 0 || index >= saved.questions.length) return saved
  const answers = { ...(saved.answers ?? {}) }
  const clipped = text.slice(0, MAX_RESUME_ANSWER_LENGTH)
  if (clipped.trim()) answers[String(index)] = { text: clipped, updatedAt }
  else delete answers[String(index)]
  return {
    ...saved,
    ...(Object.keys(answers).length > 0 ? { answers } : { answers: undefined }),
  }
}
