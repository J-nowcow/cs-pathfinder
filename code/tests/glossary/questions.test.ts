import { describe, expect, it } from 'vitest'
import type { RootSummary } from '@/lib/db/roots'
import { findGlossaryEntry, questionsForConcept } from '@/lib/glossary/questions'

const entry = { term: '멱등성', english: 'Idempotency', short: '여러 번 보내도 결과가 같다.' }
const root = (overrides: Partial<RootSummary>): RootSummary => ({
  id: overrides.id ?? crypto.randomUUID(),
  question: overrides.question ?? '질문',
  category: overrides.category ?? '네트워크',
  excerpt: overrides.excerpt ?? '해설',
  tags: overrides.tags ?? [],
  level: overrides.level ?? '기초',
})

describe('개념 찾기', () => {
  it('한글 이름과 영문 표기로 같은 항목을 찾는다', () => {
    expect(findGlossaryEntry([entry], ' 멱등성 ')).toBe(entry)
    expect(findGlossaryEntry([entry], encodeURIComponent('멱등성'))).toBe(entry)
    expect(findGlossaryEntry([entry], 'IDEMPOTENCY')).toBe(entry)
    expect(findGlossaryEntry([entry], '없는 개념')).toBeNull()
  })
})

describe('개념에서 면접 질문 찾기', () => {
  it('제목, 태그, 해설 순으로 우선한다', () => {
    const roots = [
      root({ id: 'body', excerpt: '멱등성을 보장한다.' }),
      root({ id: 'tag', tags: ['멱등성'] }),
      root({ id: 'title', question: '멱등성이 필요한 이유는?' }),
    ]

    expect(questionsForConcept(entry, roots).map((question) => question.id)).toEqual([
      'title',
      'tag',
      'body',
    ])
    expect(questionsForConcept(entry, roots).map((question) => question.reason)).toEqual([
      '질문 제목',
      '주제 태그',
      '해설 내용',
    ])
  })

  it('영문 표기도 찾고 최대 다섯 개만 돌려준다', () => {
    const roots = Array.from({ length: 7 }, (_, index) =>
      root({ id: String(index), question: `Idempotency 질문 ${index}` }),
    )
    expect(questionsForConcept(entry, roots)).toHaveLength(5)
  })

  it('짧은 영문 약어를 긴 단어의 일부로 오인하지 않는다', () => {
    const db = { term: 'DB', short: '데이터베이스.' }
    const roots = [
      root({ id: 'db', question: 'DB 커넥션은 왜 재사용하는가?' }),
      root({ id: 'dbscan', question: 'DBSCAN은 언제 쓰는가?' }),
    ]

    expect(questionsForConcept(db, roots).map((question) => question.id)).toEqual(['db'])
  })

  it('원래 순서는 같은 점수의 안정적인 타이브레이커다', () => {
    const roots = [
      root({ id: 'first', question: '멱등성 첫 질문' }),
      root({ id: 'second', question: '멱등성 둘째 질문' }),
    ]
    expect(questionsForConcept(entry, roots).map((question) => question.id)).toEqual([
      'first',
      'second',
    ])
  })
})
