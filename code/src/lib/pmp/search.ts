import { pmpCourse, pmpOrder } from './course'

export const PMP_QUERY_LIMIT = 120
const normalize = (text: string) =>
  text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

/** Plain text only: snippets are rendered by React, never as authored HTML. */
export function pmpSearchText(html: string) {
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
    times: '×',
    minus: '−',
    le: '≤',
    ge: '≥',
  }
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
      if (!key.startsWith('#')) return entities[key.toLowerCase()] ?? entity
      const point =
        key[1]?.toLowerCase() === 'x'
          ? Number.parseInt(key.slice(2), 16)
          : Number(key.slice(1))
      return point > 0 &&
        point <= 0x10ffff &&
        !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : ' '
    })
    .replace(/\s+/g, ' ')
    .trim()
}

const documents = pmpOrder.map((id, order) => {
  const n = pmpCourse.nodes.find((node) => node.id === id)!
  const chapter = pmpCourse.tracks.find((track) => track.id === n.track)!
  // Explicit public reading fields only. No quiz options, notes or user records.
  const parts = [
    n.q,
    n.answer,
    ...n.body,
    ...n.steps,
    ...('table' in n ? (n.table?.map((row) => row.join(' · ')) ?? []) : []),
    ...('worked' in n ? (n.worked ?? []) : []),
    ...('trap' in n && n.trap ? [n.trap] : []),
    ...('supplement' in n && n.supplement ? [pmpSearchText(n.supplement)] : []),
    ...n.terms.map((term) => {
      const g = pmpCourse.glossary.find((g) => g.en === term || g.ko === term)
      return g ? `${g.en} · ${g.ko} · ${g.body}` : term
    }),
  ]
    .map((part) => part.normalize('NFC').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return {
    id,
    title: n.title,
    chapter: chapter.title,
    order,
    parts,
    normalizedTitle: normalize(n.title),
    normalizedParts: parts.map(normalize),
  }
})

export function searchPmpLessons(raw: string | string[] | undefined) {
  const query = typeof raw === 'string' ? raw.slice(0, PMP_QUERY_LIMIT) : ''
  const error: 'multiple' | 'long' | null = Array.isArray(raw)
    ? 'multiple'
    : typeof raw === 'string' && raw.length > PMP_QUERY_LIMIT
      ? 'long'
      : null
  const tokens = [...new Set(normalize(query).split(' ').filter(Boolean))]
  if (error || !tokens.length) return { query, error, results: [] }
  const results = documents
    .flatMap((doc) => {
      const fields = [doc.normalizedTitle, ...doc.normalizedParts]
      if (!tokens.every((token) => fields.some((part) => part.includes(token))))
        return []
      const titleHits = tokens.filter((token) =>
        doc.normalizedTitle.includes(token),
      ).length
      const scores = doc.normalizedParts.map(
        (part) => tokens.filter((token) => part.includes(token)).length,
      )
      const at = scores.indexOf(Math.max(...scores))
      const part = doc.parts[at] ?? doc.parts[0]
      const normalized = doc.normalizedParts[at] ?? ''
      const firstHit = Math.min(
        ...tokens
          .map((token) => normalized.indexOf(token))
          .filter((at) => at >= 0),
      )
      // Normalization can change code-unit offsets (NFC). Snapshots use NFC;
      // snippets stay plain text even when a query includes HTML or regex syntax.
      const start = Number.isFinite(firstHit) ? Math.max(0, firstHit - 50) : 0
      const snippet =
        (start ? '…' : '') +
        part.slice(start, start + 220) +
        (part.length > start + 220 ? '…' : '')
      return [
        {
          id: doc.id,
          title: doc.title,
          chapter: doc.chapter,
          snippet,
          rank: titleHits === tokens.length ? 0 : titleHits ? 1 : 2,
          order: doc.order,
        },
      ]
    })
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
  return { query, error, results }
}
