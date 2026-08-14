export type LearningTrack = {
  id: string
  title: string
  description: string
  audience: string
  estimatedMinutesPerQuestion: number
  questionKeys: readonly string[]
  contentReviewedOn: string
  sources?: ReadonlyArray<{ title: string; url: string }>
}

export type TrackQuestionReference = {
  id: string
  question: string
}

export type ResolvedTrackQuestion = TrackQuestionReference & {
  position: number
}

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/

/** 정적 트랙이 현재 질문 말뭉치를 정확히 가리키는지 검사한다. */
export function validateLearningTrack(
  track: LearningTrack,
  availableQuestions: Iterable<string>,
): string[] {
  const issues: string[] = []
  const available = new Set(Array.from(availableQuestions, (question) => question.trim()))
  const seen = new Set<string>()

  if (!track.id.trim()) issues.push('트랙 id가 비어 있습니다.')
  if (!track.title.trim()) issues.push('트랙 제목이 비어 있습니다.')
  if (!Number.isFinite(track.estimatedMinutesPerQuestion) || track.estimatedMinutesPerQuestion <= 0) {
    issues.push('문제당 예상 시간은 0보다 커야 합니다.')
  }
  if (!DATE_SHAPE.test(track.contentReviewedOn)) {
    issues.push('콘텐츠 검토일은 YYYY-MM-DD 형식이어야 합니다.')
  }
  if (track.questionKeys.length === 0) issues.push('트랙에 질문이 없습니다.')

  for (const rawQuestion of track.questionKeys) {
    const question = rawQuestion.trim()
    if (!question) {
      issues.push('빈 질문 키가 있습니다.')
      continue
    }
    if (seen.has(question)) issues.push(`질문이 중복되었습니다: ${question}`)
    else seen.add(question)
    if (!available.has(question)) issues.push(`현재 말뭉치에 없는 질문입니다: ${question}`)
  }

  return issues
}

/** 트랙 순서를 보존하면서 편집 가능한 질문 키를 현재 노드 id로 바꾼다. */
export function resolveTrackQuestions(
  track: LearningTrack,
  roots: readonly TrackQuestionReference[],
): ResolvedTrackQuestion[] {
  const issues = validateLearningTrack(track, roots.map((root) => root.question))
  if (issues.length > 0) {
    throw new Error(`학습 트랙 "${track.id}"을 해석하지 못했습니다.\n${issues.join('\n')}`)
  }

  const idByQuestion = new Map<string, string>()
  for (const root of roots) {
    const question = root.question.trim()
    if (!idByQuestion.has(question)) idByQuestion.set(question, root.id)
  }

  return track.questionKeys.map((question, index) => ({
    id: idByQuestion.get(question.trim())!,
    question: question.trim(),
    position: index + 1,
  }))
}

export function estimatedTrackMinutes(track: LearningTrack): number {
  return track.estimatedMinutesPerQuestion * track.questionKeys.length
}
