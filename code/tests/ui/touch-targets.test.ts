import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('작은 조작 요소의 터치 영역', () => {
  it('질문 목록의 태그·난이도·분야 칩은 판정 영역을 넓힌다', () => {
    const source = read('src/app/(site)/questions/page.tsx')
    expect(source).toContain('const filterChip = "relative shrink-0 rounded-full')
    expect(source).toContain('before:-inset-y-1.5')
  })

  it('질문 읽기의 태그와 난이도 칩도 판정 영역을 넓힌다', () => {
    const source = read('src/components/ReadingView.tsx')
    expect(source.match(/before:-inset-y-2/g)).toHaveLength(2)
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

  it('질문 목록의 필터와 질문 링크는 키보드 초점을 표시한다', () => {
    const source = read('src/app/(site)/questions/page.tsx')
    expect(source).toContain('const filterChip = "relative shrink-0 rounded-full')
    expect(source).toMatch(/const filterChip = [^\n]+focus-visible:outline-2/)
    expect(source).toMatch(/href=\{`\/q\/\$\{r.id\}`\}[\s\S]{0,240}focus-visible:outline-2/)
  })

  it('추천과 게시판 재시도 버튼도 손끝 높이를 확보한다', () => {
    expect(read('src/components/VoteButton.tsx')).toContain('inline-flex min-h-11')
    const board = read('src/components/Board.tsx')
    expect(board).toContain('mt-4 min-h-11')
    expect(board).toContain('className="min-h-11 rounded-lg')
  })

  it('전체 질문 지도의 홈 링크도 손끝 높이를 확보한다', () => {
    const source = read('src/components/GraphMap.tsx')
    expect(source).toMatch(/href="\/"[\s\S]{0,180}className="inline-flex min-h-11/)
  })

  it('질문 지도 시트의 조작 요소는 키보드 초점을 표시한다', () => {
    const source = read('src/components/GraphMap.tsx')
    expect(source).toMatch(/onClick=\{onClose\}[\s\S]{0,240}focus-visible:outline-2/)
    expect(source).toMatch(/href=\{`\/q\/\$\{node.id\}`\}[\s\S]{0,240}focus-visible:outline-2/)
  })

  it('질문 지도의 점과 카드도 키보드 초점을 표시한다', () => {
    const source = read('src/components/GraphMap.tsx')
    expect(source).toMatch(/aria-label=\{p.question\}[\s\S]{0,360}focus-visible:outline-2/)
    expect(source).toMatch(/hover:border-accent focus-visible:outline-2/)
  })

  it('질문 지도의 확대·축소 버튼도 키보드 초점을 표시한다', () => {
    const source = read('src/app/globals.css')
    expect(source).toContain('.react-flow__controls .react-flow__controls-button:focus-visible')
    expect(source).toContain('outline: 2px solid var(--color-accent)')
  })

  it('분야 버튼의 초점선은 큰 빈 상자가 아니라 글자에만 붙인다', () => {
    const source = read('src/components/GraphMap.tsx')
    expect(source).toContain('group pointer-events-none absolute')
    expect(source.match(/group-focus-visible:outline-2/g)).toHaveLength(2)
  })

  it('공유된 질문 지도의 질문 링크도 손끝 높이를 확보한다', () => {
    expect(read('src/components/SharedTree.tsx')).toContain('group flex min-h-11')
  })

  it('답변 연습의 접기와 자기 점검도 손끝·키보드로 조작할 수 있다', () => {
    const source = read('src/components/AnswerPractice.tsx')
    expect(source.match(/<summary className="flex min-h-12/g)).toHaveLength(2)
    expect(source.match(/className="min-h-11 rounded-lg border border-line/g)).toHaveLength(2)
    expect(source).toContain('focus-visible:outline-2')
    expect(source).toContain('aria-pressed={reviewStatus ===')
  })
})
