import { pmpLessonHref } from './routes'
import course from '../../../pm-content/pmp/source/course.json'
import editorial from '../../../learning-content/pmp-editorial.json'

// Native reading copy can evolve without modifying the preserved offline snapshot.
const edits: Record<
  string,
  { title: string; q: string; answer: string; body: string[] }
> = editorial
export const pmpCourse = {
  ...course,
  nodes: course.nodes.map((node) => ({ ...node, ...edits[node.id] })),
}
export const lessonById = new Map(pmpCourse.nodes.map((n) => [n.id, n]))
export const pmpOrder = course.readingOrder
export { pmpLessonHref } from './routes'
/** Only authored snapshot HTML. CI rejects active content before a release. */
export function nativePmpHtml(html: string): string {
  if (
    /<(?:script|iframe|object|embed|form|input|button)\b|\son\w+\s*=|javascript:|data:text\/html/i.test(
      html,
    )
  ) {
    throw new Error('Active content is not allowed in the PMP reading snapshot')
  }
  return html.replace(/href="pmp-lesson:(n\d+)"/g, (_, id: string) => {
    if (!lessonById.has(id)) throw new Error('Unknown PMP lesson link')
    return `href="${pmpLessonHref(id)}"`
  })
}
