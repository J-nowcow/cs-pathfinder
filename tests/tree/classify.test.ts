import { describe, it, expect } from 'vitest'
import { classifyTitle, isKnownCategory } from '@/lib/tree/classify'
import { CATEGORIES } from '@/lib/tree/categories'

/**
 * 제목에서 카테고리를 고르는 규칙.
 *
 * 이 분류기는 원래 수집 스크립트 안에 있었고 시험이 없었다. 실제로 틀렸다 —
 * `CI`를 부분 문자열로 보다가 `Computer Science`의 `sci`에 걸려서, 그 섹션의
 * 23건이 전부 인프라·보안으로 흘러갔다. `LinkedList`와 `B-Tree`가 보안
 * 카테고리에 들어가 있었다.
 */
describe('classifyTitle', () => {
  /** 이것이 실제로 틀렸던 자리다 */
  it('does not put data structures under security', () => {
    expect(classifyTitle('LinkedList')).toBe('자료구조 · 알고리즘')
    expect(classifyTitle('트라이(Trie)')).toBe('자료구조 · 알고리즘')
    expect(classifyTitle('B-Tree & B+Tree')).toBe('데이터베이스')
  })

  /** 짧은 영문 약어가 아무 낱말에나 걸리면 안 된다 */
  it('matches an abbreviation only on a word boundary', () => {
    expect(classifyTitle('Computer Science')).not.toBe('인프라 · 보안')
    expect(classifyTitle('CI 파이프라인을 어떻게 나누는가?')).toBe('인프라 · 보안')
  })

  it('picks the obvious category for each area', () => {
    expect(classifyTitle('안드로이드 액티비티 생명주기')).toBe('모바일')
    expect(classifyTitle('스프링 빈 생명주기')).toBe('프레임워크')
    expect(classifyTitle('브라우저 렌더링 과정')).toBe('프론트엔드')
    expect(classifyTitle('인덱스는 언제 안 타는가?')).toBe('데이터베이스')
    expect(classifyTitle('TCP 3-way handshake')).toBe('네트워크')
    expect(classifyTitle('데드락이 생기는 조건')).toBe('운영체제')
    expect(classifyTitle('JVM 메모리 구조')).toBe('언어 · 런타임')
    expect(classifyTitle('Saga 패턴이 필요한 이유')).toBe('아키텍처 · 분산시스템')
    expect(classifyTitle('JWT를 세션 대신 쓸 때')).toBe('인프라 · 보안')
  })

  /**
   * 앞 규칙이 이긴다. 모바일이 먼저라 안드로이드 메모리 얘기는 운영체제가
   * 아니라 모바일이다 — 읽는 사람이 찾을 자리가 그쪽이다.
   */
  it('lets the earlier rule win when words overlap', () => {
    expect(classifyTitle('안드로이드 메모리 누수')).toBe('모바일')
    expect(classifyTitle('JPA 트랜잭션 전파')).toBe('프레임워크')
  })

  it('gives up instead of guessing', () => {
    expect(classifyTitle('오늘 점심은 무엇인가')).toBeNull()
  })

  /** 고른 값은 반드시 목록에 있어야 한다. 없는 값이 새면 화면이 빈 칸을 만든다 */
  it('only ever returns a known category', () => {
    const titles = [
      'LinkedList', 'TCP 3-way handshake', '데드락', 'JVM 메모리 구조',
      '안드로이드 액티비티', '스프링 빈', '브라우저 렌더링', '인덱스', 'JWT', 'Saga 패턴',
    ]
    for (const t of titles) {
      const c = classifyTitle(t)
      if (c !== null) expect(isKnownCategory(c)).toBe(true)
    }
  })

  it('covers every category with at least one rule', () => {
    const reachable = new Set(
      [
        'LinkedList', 'TCP', '데드락', 'JVM', '안드로이드', '스프링', '브라우저', '인덱스', 'JWT', 'Saga 패턴',
      ].map((t) => classifyTitle(t)),
    )
    const missing = CATEGORIES.filter((c) => !reachable.has(c))
    expect(missing).toEqual([])
  })
})
