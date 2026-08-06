import { describe, it, expect } from 'vitest'
import { CATEGORIES, categoryAnchor } from '@/lib/tree/categories'

/**
 * 카테고리 앵커.
 *
 * 목록 화면이 이 id를 붙이고 푸터가 이 id로 보낸다. 두 곳이 각자 만들면 한쪽만
 * 바뀌었을 때 링크가 조용히 아무 데도 안 간다. 그래서 한 함수로 모았다.
 */
describe('categoryAnchor', () => {
  /* 공백과 가운뎃점이 그대로 들어가면 CSS 선택자와 URL 양쪽에서 깨진다 */
  it('removes spaces and middle dots', () => {
    expect(categoryAnchor('언어 · 런타임')).toBe('c-언어-런타임')
    expect(categoryAnchor('자료구조 · 알고리즘')).toBe('c-자료구조-알고리즘')
  })

  /* 한글은 그대로 둔다. 주소창에서 어디인지 알아볼 수 있어야 한다 */
  it('keeps Korean readable', () => {
    expect(categoryAnchor('네트워크')).toBe('c-네트워크')
  })

  /* 두 카테고리가 같은 앵커를 가지면 한쪽으로만 스크롤된다 */
  it('gives every category its own anchor', () => {
    const anchors = CATEGORIES.map(categoryAnchor)
    expect(new Set(anchors).size).toBe(CATEGORIES.length)
  })

  /* 숫자로 시작하거나 공백이 남으면 선택자로 못 쓴다 */
  it('produces a usable id', () => {
    for (const c of CATEGORIES) {
      const a = categoryAnchor(c)
      expect(a).not.toMatch(/\s/)
      expect(a).toMatch(/^c-/)
    }
  })
})
