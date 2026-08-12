import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 기능 이름은 화면마다 같은 뜻으로 쓴다.
 *
 * `파고들기`는 서비스의 비유로는 남길 수 있다. 하지만 버튼과 상태까지 전부 같은
 * 말로 부르면 질문을 여는지, 새로 만드는지, 지도를 공유하는지 알 수 없다.
 */
const CORE_FILES = [
  'src/components/TodayCard.tsx',
  'src/components/RootCard.tsx',
  'src/components/ReadingView.tsx',
  'src/components/Suggestions.tsx',
  'src/components/FreeInput.tsx',
  'src/components/Board.tsx',
  'src/components/ShareSheet.tsx',
  'src/components/MapModal.tsx',
  'src/components/MinimapStrip.tsx',
  'src/components/RelatedList.tsx',
]

const source = CORE_FILES.map((file) => readFileSync(file, 'utf8')).join('\n')

describe('핵심 화면 용어', () => {
  it.each([
    '오늘 치 질문',
    '이미 파인 길',
    '더 파고들 질문 만들기',
    '파고드는 중',
    '이 질문의 트리 보기',
    '파고든 길 공유하기',
    '파고든 지도',
    '이거 봤으면 이것도',
  ])('예전 표현 %s 을 다시 쓰지 않는다', (legacy) => {
    expect(source).not.toContain(legacy)
  })

  it.each(['오늘의 질문', '질문 읽기', '이어갈 꼬리질문', '원하는 꼬리질문 만들기', '질문 지도', '관련 질문'])(
    '기준 표현 %s 을 유지한다',
    (term) => {
      expect(source).toContain(term)
    },
  )

  it('전체 질문 지도와 개인 지도를 짧은 이름으로 구분한다', () => {
    const header = readFileSync('src/components/SiteHeader.tsx', 'utf8')
    const minimap = readFileSync('src/components/MinimapStrip.tsx', 'utf8')
    expect(header).toContain("{ href: '/map', label: '지도' }")
    expect(minimap).toContain('내 지도')
  })

  it('질문을 모아 보는 화면은 질문 목록으로 부른다', () => {
    const page = readFileSync('src/app/(site)/questions/page.tsx', 'utf8')
    expect(page).toContain("title: '질문 목록'")
    expect(page).toContain('질문 목록')
    expect(page).not.toContain('title: \'카테고리별 질문\'')
  })
})
