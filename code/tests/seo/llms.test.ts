import { describe, it, expect } from 'vitest'
import { renderLlms, renderLlmsFull } from '@/lib/seo/llms'
import type { Catalog } from '@/lib/db/catalog'

/**
 * LLM 안내판.
 *
 * 형식이 곧 계약이다 — llms.txt 스펙은 H1 하나와 인용구 요약, 그리고
 * 링크 목록을 기대한다. 링크가 깨지면 에이전트가 따라올 수 없다.
 */
const catalog: Catalog = {
  date: '2026-08-11',
  entries: [
    { id: 'a1', question: 'CORS는 무엇을 막는가?', category: '네트워크', publishDate: '2026-08-01', body: '응답 읽기를 막는다.' },
    { id: 'b2', question: '데드락의 조건은?', category: '운영체제', publishDate: null, body: '네 조건이다.' },
  ],
  byCategory: [
    { category: '네트워크', entries: [{ id: 'a1', question: 'CORS는 무엇을 막는가?', category: '네트워크', publishDate: '2026-08-01', body: '응답 읽기를 막는다.' }] },
    { category: '운영체제', entries: [{ id: 'b2', question: '데드락의 조건은?', category: '운영체제', publishDate: null, body: '네 조건이다.' }] },
  ],
}

describe('llms.txt', () => {
  it('H1과 요약 인용구로 시작한다', () => {
    const out = renderLlms(catalog, 'https://example.com')
    expect(out.startsWith('# CS 길라잡이\n\n> ')).toBe(true)
  })

  it('질문마다 절대 주소 링크가 걸린다', () => {
    const out = renderLlms(catalog, 'https://example.com')
    expect(out).toContain('[CORS는 무엇을 막는가?](https://example.com/q/a1)')
    expect(out).toContain('[데드락의 조건은?](https://example.com/q/b2)')
  })

  it('전문판 주소를 알린다', () => {
    expect(renderLlms(catalog, 'https://example.com')).toContain('https://example.com/llms-full.txt')
  })
})

describe('llms-full.txt', () => {
  it('해설 본문이 그대로 담긴다', () => {
    const out = renderLlmsFull(catalog, 'https://example.com')
    expect(out).toContain('## CORS는 무엇을 막는가?')
    expect(out).toContain('응답 읽기를 막는다.')
    expect(out).toContain('원문: https://example.com/q/a1')
  })

  it('도식 문법의 뜻을 머리말에 알린다', () => {
    expect(renderLlmsFull(catalog, 'https://example.com')).toContain(':::')
  })
})
