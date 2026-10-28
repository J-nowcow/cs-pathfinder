import course from '../../../learning-content/certificate/course.json'
export type Cell = string | number | null
export type CertificateLesson = {
  id: string
  domain: 'db-sql' | 'testing' | 'network'
  title: string
  question: string
  lead: string
  body: string[]
  example: {
    code?: string
    text: string
    headers?: string[]
    rows?: Cell[][]
    verification?: string
  }
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
export { certificateHref } from './routes'
export const certificateDomain = (lesson: CertificateLesson) =>
  certificate.domains.find((domain) => domain.id === lesson.domain)!.title
