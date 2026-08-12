import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('작은 조작 요소의 터치 영역', () => {
  it('질문 목록의 태그·난이도·분야 칩은 판정 영역을 넓힌다', () => {
    const source = read('src/app/(site)/questions/page.tsx')
    expect(source).toContain('const filterChip = "relative rounded-full')
    expect(source).toContain('before:-inset-y-1.5')
  })

  it('오류 배너의 다시 시도 버튼은 손끝 높이를 확보한다', () => {
    const source = read('src/components/Banners.tsx')
    expect(source).toMatch(/onClick=\{onRetry\}[\s\S]{0,180}className="min-h-11/)
  })

  it('선택된 질문 필터를 화면 낭독기에도 알린다', () => {
    const source = read('src/app/(site)/questions/page.tsx')
    expect(source).toContain("aria-current={!activeTag ? 'true' : undefined}")
    expect(source).toContain("aria-current={activeTag === t.name ? 'true' : undefined}")
    expect(source).toContain("aria-current={activeLevel === l.name ? 'true' : undefined}")
  })
})
