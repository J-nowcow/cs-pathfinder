import { describe, expect, it } from 'vitest'
import { catalogTagCounts, matchesCatalogQuery, normalizeCatalogQuery } from '@/lib/catalog/search'

const root = {
  id: 'q1',
  question: 'Circuit Breaker와 retry를 함께 쓰면 어떻게 되는가?',
  category: '아키텍처 · 분산시스템',
  excerpt: '재시도 트래픽이 장애를 키우는 retry storm을 막아야 한다.',
  tags: ['장애 대응', '복원력'],
  level: '기본',
}

describe('질문 목록 검색', () => {
  it('앞뒤와 연속 공백을 정리한다', () => {
    expect(normalizeCatalogQuery('  retry   storm  ')).toBe('retry storm')
  })

  it('제목·해설·분야·태그를 대소문자 없이 찾는다', () => {
    expect(matchesCatalogQuery(root, 'circuit breaker')).toBe(true)
    expect(matchesCatalogQuery(root, 'RETRY STORM')).toBe(true)
    expect(matchesCatalogQuery(root, '분산시스템')).toBe(true)
    expect(matchesCatalogQuery(root, '복원력')).toBe(true)
  })

  it('여러 단어를 모두 포함해야 한다', () => {
    expect(matchesCatalogQuery(root, 'retry 장애')).toBe(true)
    expect(matchesCatalogQuery(root, 'retry 데이터베이스')).toBe(false)
  })

  it('빈 검색어는 모든 질문을 남긴다', () => {
    expect(matchesCatalogQuery(root, '')).toBe(true)
  })

  it('검색 결과 안에서만 태그 개수를 센다', () => {
    const counts = catalogTagCounts([
      root,
      { ...root, id: 'q2', tags: ['복원력', '네트워크'] },
    ])
    expect(counts.get('복원력')).toBe(2)
    expect(counts.get('장애 대응')).toBe(1)
    expect(counts.get('네트워크')).toBe(1)
  })
})
