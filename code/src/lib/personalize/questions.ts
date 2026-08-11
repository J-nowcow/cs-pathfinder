import { containsSuspectedPii, containsUnsafeControlChars } from '@/lib/expand/validate'
import { blocking, questionIssues } from '@/lib/llm/content-rules'

export const MIN_PERSONALIZED_QUESTIONS = 5
export const MAX_PERSONALIZED_QUESTIONS = 10

export type PersonalizedQuestionIssueCode =
  | 'not_array'
  | 'count'
  | 'not_text'
  | 'empty'
  | 'format'
  | 'duplicate'
  | 'sensitive'
  | 'forbidden_term'

export type PersonalizedQuestionIssue = {
  code: PersonalizedQuestionIssueCode
  detail: string
  index?: number
}

export type PersonalizedQuestionResult =
  | { ok: true; questions: string[] }
  | { ok: false; issues: PersonalizedQuestionIssue[] }

const URL = /(?:https?:\/\/|www\.)\S+/i
const TRAILING_PUNCTUATION = /[?？!.…\s]+$/

function normalizeQuestion(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ')
}

function duplicateKey(value: string): string {
  return value.toLocaleLowerCase('en-US').replace(TRAILING_PUNCTUATION, '').replace(/\s+/g, '')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 영문·숫자 고유명사는 낱말 경계에서만 찾는다.
 *
 * `go` 레포를 금칙어로 줬다고 `goroutine`까지 막으면 맞춤 질문의 핵심을 잃는다.
 * 한글이 섞인 이름은 조사까지 붙으므로 단순 포함으로 찾는다.
 */
function containsForbiddenTerm(question: string, term: string): boolean {
  const normalized = term.normalize('NFKC').trim()
  if (!normalized) return false

  if (/^[A-Za-z0-9._-]+$/.test(normalized)) {
    const escaped = escapeRegExp(normalized)
    return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, 'i').test(question)
  }

  return question.toLocaleLowerCase('ko-KR').includes(normalized.toLocaleLowerCase('ko-KR'))
}

/**
 * 모델이 만든 맞춤 질문을 저장하거나 노드로 만들기 전에 검사한다.
 *
 * 기존 노드의 질문 규칙을 그대로 재사용한다. 여기에 맞춤 입력 특유의 위험인
 * 연락처·URL·고유명사 유출과 중복을 더 막는다. 금칙어에는 레포 owner/name이나
 * 자소서에서 추출한 회사명·사람 이름을 넘긴다.
 */
export function validatePersonalizedQuestions(
  input: unknown,
  forbiddenTerms: readonly string[] = [],
): PersonalizedQuestionResult {
  if (!Array.isArray(input)) {
    return { ok: false, issues: [{ code: 'not_array', detail: '질문 목록 형식이 아닙니다.' }] }
  }

  const issues: PersonalizedQuestionIssue[] = []
  if (input.length < MIN_PERSONALIZED_QUESTIONS || input.length > MAX_PERSONALIZED_QUESTIONS) {
    issues.push({
      code: 'count',
      detail: `맞춤 질문은 ${MIN_PERSONALIZED_QUESTIONS}~${MAX_PERSONALIZED_QUESTIONS}개여야 합니다.`,
    })
  }

  const questions: string[] = []
  const seen = new Map<string, number>()

  input.forEach((raw, index) => {
    if (typeof raw !== 'string') {
      issues.push({ code: 'not_text', detail: '질문이 문자열이 아닙니다.', index })
      return
    }

    const hasUnsafeControlChars = containsUnsafeControlChars(raw)
    const question = normalizeQuestion(raw)
    questions.push(question)

    if (!question) {
      issues.push({ code: 'empty', detail: '빈 질문이 있습니다.', index })
      return
    }

    if (hasUnsafeControlChars) {
      issues.push({ code: 'format', detail: '허용되지 않는 문자가 포함되어 있습니다.', index })
    }

    for (const issue of blocking(questionIssues(question))) {
      issues.push({ code: 'format', detail: issue.detail, index })
    }

    if (containsSuspectedPii(question) || URL.test(question)) {
      issues.push({ code: 'sensitive', detail: '연락처나 URL이 질문에 포함되어 있습니다.', index })
    }

    const leaked = forbiddenTerms.find((term) => containsForbiddenTerm(question, term))
    if (leaked) {
      issues.push({
        code: 'forbidden_term',
        detail: '입력에서 가져온 고유명사가 질문에 남아 있습니다.',
        index,
      })
    }

    const key = duplicateKey(question)
    const first = seen.get(key)
    if (first !== undefined) {
      issues.push({
        code: 'duplicate',
        detail: `${first + 1}번과 같은 질문입니다.`,
        index,
      })
    } else {
      seen.set(key, index)
    }
  })

  return issues.length > 0 ? { ok: false, issues } : { ok: true, questions }
}
