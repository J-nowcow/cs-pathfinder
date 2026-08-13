import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../../src/components/MePanel.tsx', import.meta.url), 'utf8')

describe('MePanel 로딩 상태', () => {
  it('학습 기록을 복원하는 동안 상태 문구와 로더를 함께 보여준다', () => {
    expect(source).toContain('role="status"')
    expect(source).toContain('학습 기록을 불러오는 중')
    expect(source).toContain('animate-spin')
    expect(source).toContain('aria-busy="true"')
  })

  it('추천 질문 링크에 키보드 초점 표시를 둔다', () => {
    expect(source).toContain('hover:border-accent focus-visible:outline-2')
  })

  it('열어 본 기록과 직접 답한 기록을 나눠 보여준다', () => {
    expect(source).toContain("loadAnswerPractice()")
    expect(source).toContain("k: '열어 본 질문'")
    expect(source).toContain("k: '답변해 본 질문'")
    expect(source).toContain('sm:grid-cols-4')
    expect(source).toContain('답변 기록')
    expect(source).toContain('질문을 열면 초안을 이어 쓸 수 있습니다')
    expect(source).toContain('답변 초안은 로그인해도')
  })
})
