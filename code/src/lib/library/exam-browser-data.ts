import type { ExamQuestion } from '@/components/library/ExamBrowser'

/** Keep canonical review metadata on the server, outside the interactive props. */
export function examBrowserQuestions(questions: readonly ExamQuestion[]): ExamQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    round: q.round,
    session: q.session,
    number: q.number,
    text: q.text,
    rawTopics: q.rawTopics,
    types: q.types,
    sourceUrl: q.sourceUrl,
    quality: q.quality,
    topics: q.topics,
    backgroundTopics: q.backgroundTopics,
    classification: q.classification === null ? null : {
      core: q.classification.core,
      background: q.classification.background,
      implicitDemand: q.classification.implicitDemand,
      rationale: q.classification.rationale,
      reviewedAt: q.classification.reviewedAt,
    },
  }))
}
