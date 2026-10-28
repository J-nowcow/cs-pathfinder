import { pmpLessonHref } from './routes'
import course from '../../../pm-content/pmp/source/course.json'
import editorial from '../../../learning-content/pmp-editorial.json'
import caseTitles from '../../../learning-content/pmp-case-editorial.json'
import headings from '../../../learning-content/pmp-heading-editorial.json'

// Native reading copy can evolve without modifying the preserved offline snapshot.
const edits: Record<
  string,
  Partial<{ title: string; q: string; answer: string; body: string[] }>
> = editorial
const headingEdits: Record<string, Record<string, string>> = headings
function readingHeadings(html: string, id: string) {
  return html.replace(
    /(<h[1-6]\b[^>]*>)([\s\S]*?)(<\/h[1-6]>)/gi,
    (all, open, body, close) => {
      const key = body
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .trim()
      const title = headingEdits[id]?.[key]
      return title
        ? open +
            title
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;') +
            close
        : all
    },
  )
}
export const pmpCourse = {
  ...course,
  nodes: course.nodes.map((node) => ({
    ...node,
    ...edits[node.id],
    ...('supplement' in node && node.supplement
      ? { supplement: readingHeadings(node.supplement, node.id) }
      : {}),
  })),
  cases: course.cases.map((item) => ({
    ...item,
    title: (caseTitles as Record<string, string>)[item.id] ?? item.title,
    debrief: readingHeadings(item.debrief, item.id),
  })),
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
