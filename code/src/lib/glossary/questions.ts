import type { GlossaryEntry } from '../../../data/glossary'
import type { RootSummary } from '@/lib/db/roots'

export type ConceptQuestion = Pick<RootSummary, 'id' | 'question' | 'category' | 'level'> & {
  reason: '질문 제목' | '주제 태그' | '해설 내용'
}

const normalized = (value: string) => {
  /* Next 버전과 호출 위치에 따라 동적 경로가 인코딩된 채 올 수도 있다. */
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    /* 잘못된 주소는 원문으로 비교하고, 못 찾으면 404로 끝낸다 */
  }
  return decoded.trim().toLocaleLowerCase('ko-KR')
}

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `DB`가 `DBSCAN`에 걸리는 식의 영문 약어 오탐을 막는다. */
function containsTerm(text: string, term: string): boolean {
  if (!/^[a-z0-9.+#-]+$/i.test(term)) return text.includes(term)
  return new RegExp(`(^|[^a-z0-9])${escaped(term)}($|[^a-z0-9])`, 'i').test(text)
}

/** 주소에 든 한글 이름이나 영문 표기로 사전 항목을 찾는다. */
export function findGlossaryEntry(
  entries: readonly GlossaryEntry[],
  raw: string,
): GlossaryEntry | null {
  const query = normalized(raw)
  if (!query) return null
  return (
    entries.find(
      (entry) =>
        normalized(entry.term) === query ||
        (entry.english !== undefined && normalized(entry.english) === query),
    ) ?? null
  )
}

/**
 * 용어에서 면접 질문을 역으로 찾는다.
 *
 * 질문 제목에 직접 등장하는 것을 먼저 보여 준다. 다음은 사람이 붙인 통제
 * 태그, 마지막은 해설 첫 문장이다. 단순 본문 언급이 핵심 질문보다 앞서면
 * `API`처럼 자주 쓰이는 용어에서 엉뚱한 결과가 상단을 차지한다.
 *
 * 런타임 모델은 부르지 않는다. 같은 말뭉치에서는 누구에게나 같은 결과가
 * 나오므로 링크를 공유해도 순서가 흔들리지 않는다.
 */
export function questionsForConcept(
  entry: GlossaryEntry,
  roots: readonly RootSummary[],
  limit = 5,
): ConceptQuestion[] {
  const aliases = [entry.term, entry.english].filter((value): value is string => Boolean(value))
  const terms = aliases.map(normalized)

  return roots
    .map((root, index) => {
      const question = normalized(root.question)
      const tags = root.tags.map(normalized)
      const excerpt = normalized(root.excerpt)

      if (terms.some((term) => containsTerm(question, term))) {
        return { root, index, score: 3, reason: '질문 제목' as const }
      }
      if (terms.some((term) => tags.some((tag) => containsTerm(tag, term)))) {
        return { root, index, score: 2, reason: '주제 태그' as const }
      }
      if (terms.some((term) => containsTerm(excerpt, term))) {
        return { root, index, score: 1, reason: '해설 내용' as const }
      }
      return null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, limit))
    .map(({ root, reason }) => ({
      id: root.id,
      question: root.question,
      category: root.category,
      level: root.level,
      reason,
    }))
}
