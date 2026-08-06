import { describe, it, expect } from 'vitest'
import { shortlist, tokenize } from '@/lib/relations/shortlist'

/**
 * 판정에 물어볼 후보를 고른다.
 *
 * 249개를 전부 물어보면 프롬프트가 10KB고, 몇 천 개가 되면 못 물어본다. 그보다
 * 후보가 많을수록 판정이 헐거워진다 — 고를 것이 많으면 아무거나 고른다.
 *
 * 카테고리로만 자르지는 않는다. 사용자가 짚은 대로 네트워크와 모바일은 이어지고,
 * 카테고리로 가두면 그 선이 영영 안 생긴다.
 */
const N = (id: string, question: string, category: string) => ({ id, question, category })

describe('tokenize', () => {
  it('keeps meaningful words', () => {
    expect(tokenize('TCP는 무엇을 보장하는가?')).toContain('tcp')
  })

  /* 조사만 다른 같은 낱말은 같은 것으로 본다. "인덱스는"과 "인덱스가" */
  it('strips Korean particles', () => {
    expect(tokenize('인덱스는 언제 안 타는가?')).toContain('인덱스')
    expect(tokenize('인덱스가 왜 필요한가?')).toContain('인덱스')
  })

  /*
   * 어느 질문에나 있는 말은 뺀다. "무엇", "왜", "어떻게"로 이으면 모든 질문이
   * 모든 질문과 이어진다.
   */
  it('drops words every question has', () => {
    const t = tokenize('왜 무엇을 어떻게 하는가?')
    expect(t).not.toContain('무엇')
    expect(t).not.toContain('어떻게')
  })

  /* 한 글자는 우연히 겹친다 */
  it('drops single characters', () => {
    expect(tokenize('가 나 다 인덱스')).toEqual(['인덱스'])
  })
})

describe('shortlist', () => {
  const focus = N('f', '네트워크 지연은 왜 생기는가?', '네트워크')

  it('excludes the focus question', () => {
    const out = shortlist(focus, [focus, N('a', '인덱스는 언제 안 타는가?', '데이터베이스')])
    expect(out.map((n) => n.id)).not.toContain('f')
  })

  /* 낱말이 겹치면 카테고리가 달라도 부른다. 이 선이 안 생기면 그물이 안 된다 */
  it('picks cross-category questions that share words', () => {
    const out = shortlist(focus, [
      N('mobile', '모바일에서 네트워크 지연을 어떻게 줄이는가?', '모바일'),
      N('far', '재귀 함수의 종료 조건은 무엇인가?', '자료구조 · 알고리즘'),
    ])
    expect(out.map((n) => n.id)).toContain('mobile')
  })

  /* 겹치는 낱말이 하나도 없으면 부르지 않는다. 물어봐야 "관계 없음"이 온다 */
  it('skips questions with nothing in common', () => {
    const out = shortlist(focus, [N('far', '재귀 함수의 종료 조건은 무엇인가?', '자료구조 · 알고리즘')])
    expect(out).toHaveLength(0)
  })

  /*
   * 같은 카테고리는 낱말이 안 겹쳐도 얼마간 부른다. 같은 분야는 실제로 자주
   * 이어지는데 표현이 달라 낱말이 안 겹치는 일이 흔하다.
   */
  it('still asks about same-category questions', () => {
    const out = shortlist(focus, [N('net', '자물쇠 표시는 무엇을 검증한 결과인가?', '네트워크')])
    expect(out.map((n) => n.id)).toContain('net')
  })

  /* 낱말이 많이 겹칠수록 앞에 온다. 잘라낼 때 뒤부터 잘린다 */
  it('ranks stronger overlap first', () => {
    const out = shortlist(focus, [
      N('weak', '네트워크 카드는 무엇을 하는가?', '데이터베이스'),
      N('strong', '네트워크 지연을 줄이는 방법은?', '데이터베이스'),
    ])
    expect(out[0].id).toBe('strong')
  })

  it('caps the list', () => {
    const many = Array.from({ length: 60 }, (_, i) => N(`n${i}`, `네트워크 지연 사례 ${i}는 무엇인가?`, '네트워크'))
    expect(shortlist(focus, many, { limit: 20 })).toHaveLength(20)
  })

  /* 같은 점수면 항상 같은 순서여야 한다. 안 그러면 회차마다 후보가 달라진다 */
  it('is deterministic on ties', () => {
    const pool = [
      N('b', '네트워크 지연 측정은 어떻게 하는가?', '네트워크'),
      N('a', '네트워크 지연 원인은 무엇인가?', '네트워크'),
    ]
    const first = shortlist(focus, pool).map((n) => n.id)
    const second = shortlist(focus, [...pool].reverse()).map((n) => n.id)
    expect(first).toEqual(second)
  })
})
