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
})
