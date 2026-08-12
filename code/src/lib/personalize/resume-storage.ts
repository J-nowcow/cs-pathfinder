export const RESUME_QUESTIONS_STORAGE_KEY = 'cspf_resume_questions_v1'

export type ResumeQuestion = {
  text: string
  basis: string
  topic: string
}

export type SavedResumeQuestions = {
  version: 1
  createdAt: string
  questions: ResumeQuestion[]
}

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
): string {
  return JSON.stringify({ version: 1, createdAt, questions } satisfies SavedResumeQuestions)
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
    return value as SavedResumeQuestions
  } catch {
    return null
  }
}
