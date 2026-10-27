import course from '../../../learning-content/certificate/course.json'
export type Cell = string | number | null
export type CertificateLesson = {
  id: string
  title: string
  question: string
  lead: string
  body: string[]
  example: { code?: string; text: string; headers?: string[]; rows?: Cell[][] }
  comparison: string[][]
  trap: string
  recall: string
  recallAnswer: string
  originConceptIds: string[]
  sources: string[]
  flow: string[]
  checklist: string[]
}
export const certificate = course as Omit<typeof course, 'lessons'> & {
  lessons: CertificateLesson[]
}
export const certificateLessons = new Map(
  certificate.lessons.map((n) => [n.id, n]),
)
export const certificateHref = (id: string) =>
  '/learn/certificate/' + encodeURIComponent(id)
