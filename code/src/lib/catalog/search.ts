import type { RootSummary } from '@/lib/db/roots'

export const MAX_CATALOG_QUERY = 80

/** 주소와 입력창이 같은 검색어를 쓰도록 공백과 길이를 한곳에서 정리한다. */
export function normalizeCatalogQuery(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_CATALOG_QUERY)
}

/**
 * 질문 목록의 가벼운 검색.
 *
 * 질문 제목을 몰라도 분야·태그나 해설 첫 문장으로 찾을 수 있다. 목록이 이미
 * 들고 있는 데이터만 써서 별도 검색 API와 클라이언트 번들을 만들지 않는다.
 */
export function matchesCatalogQuery(root: RootSummary, query: string): boolean {
  if (!query) return true
  const words = query.toLocaleLowerCase('ko-KR').split(' ')
  const haystack = [root.question, root.excerpt, root.category, ...root.tags]
    .join(' ')
    .toLocaleLowerCase('ko-KR')
  return words.every((word) => haystack.includes(word))
}
