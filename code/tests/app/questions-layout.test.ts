import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 목록 화면의 배치.
 *
 * 재보니 폰에서 249행 × 49px = 14,906px, **19.6화면**이었다. 데스크톱도
 * 13,887px인데 본문이 768px에 한 줄 28자라 좌우 672px가 놀고 있었다.
 *
 * 스크롤 총량 자체보다 아픈 것은 **되감기**였다. 목차가 맨 위에 고정돼 있어서
 * 다른 분야로 가려면 19화면을 거슬러 올라가야 했다.
 *
 * 배치는 CSS라 단위 시험으로 렌더링을 재기 어렵다. 대신 **의도가 코드에 남아
 * 있는지**를 본다. 실제 픽셀은 CDP로 재서 커밋 메시지에 적었다 —
 * 데스크톱 13,887 → 8,884px, 폰 목차가 6,000px 지점에서도 top 56px에 붙어 있다.
 */
const SRC = readFileSync(
  resolve(process.cwd(), 'src/app/(site)/questions/page.tsx'),
  'utf8',
)

describe('/questions 배치', () => {
  /*
   * 목차가 따라다녀야 한다. 이게 빠지면 19화면 되감기가 돌아온다.
   */
  it('keeps the category index in reach while scrolling', () => {
    expect(SRC).toMatch(/<nav[^>]*className="[^"]*sticky/)
  })

  /* 헤더 아래에 서야 한다. 안 그러면 헤더에 가린다 */
  it('parks the index below the site header', () => {
    expect(SRC).toMatch(/<nav[^>]*top-14/)
  })

  /*
   * 배경이 없으면 아래 글이 비쳐 목차가 안 읽힌다. sticky를 쓰는 순간 필수다.
   */
  it('gives the sticky index a background', () => {
    expect(SRC).toMatch(/<nav[^>]*bg-surface/)
  })

  /*
   * 넓은 화면은 두 줄로 세운다. 폰은 한 줄 그대로다 — 350px를 반으로 가르면
   * 열두 자라 제목이 세 줄로 접혀 오히려 길어진다.
   */
  it('splits into two columns only on wider screens', () => {
    expect(SRC).toMatch(/<ul[^>]*sm:grid-cols-2/)
    // 접두사 없는 grid-cols-2가 없어야 한다. `\b`는 `sm:` 뒤에서도 맞아서 못 쓴다
    expect(SRC).not.toMatch(/<ul[^>]*className="[^"]*[\s"]grid-cols-2/)
  })

  /*
   * 격자에서는 `divide-y`가 안 듣는다. 열이 갈리면 세로 이웃이 형제가 아니다.
   * 줄마다 아래 선을 직접 준다.
   */
  it('draws row dividers per item, not with divide-y', () => {
    expect(SRC).toMatch(/<li[^>]*border-b border-line/)
    expect(SRC).not.toMatch(/<ul[^>]*divide-y/)
  })
})
