import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 손끝 크기를 키운 자리가 짝을 지키는가.
 *
 * 폰에서 나가는 링크들이 16~20px이었다. 보이는 글자는 그대로 두고 판정만 키우는
 * 방법을 쓴다 — `py`를 키우고 **같은 만큼** `-my`로 당기면 줄 높이가 안 변한다.
 *
 * **둘 중 하나만 빠지면 조용히 깨진다.** `-my`가 빠지면 줄 높이가 늘어 위아래
 * 간격이 어긋나고, `py`가 빠지면 판정이 도로 작아지는데 화면은 똑같아 보인다.
 * 후자는 눈으로 절대 안 잡힌다.
 *
 * 값이 서로 다르면 반만 당긴 것이라 그것도 잡는다.
 *
 * 소스를 읽어 보는 시험이다. 이 셋은 서버 컴포넌트라 화면째로 띄우려면 DB가
 * 필요한데, 지키려는 것이 "클래스가 짝을 이루는가" 하나라 그것으로 충분하다.
 */
const BACK_LINKS = [
  { file: 'src/app/(site)/questions/page.tsx', label: '카테고리별 질문 화면' },
  { file: 'src/app/(site)/t/[slug]/page.tsx', label: '공유 트리 화면' },
  { file: 'src/components/ReadingView.tsx', label: '질문 화면' },
]

describe('나가는 링크의 손끝 크기', () => {
  it.each(BACK_LINKS)('$label 은 py와 -my를 짝으로 가진다', ({ file }) => {
    const src = readFileSync(file, 'utf8')
    const pairs = [...src.matchAll(/-my-\[(\d+)px\]\s+py-\[(\d+)px\]|py-\[(\d+)px\]\s+-my-\[(\d+)px\]/g)]
    expect(pairs.length).toBeGreaterThan(0)
    for (const m of pairs) {
      const [a, b] = m[1] ? [m[1], m[2]] : [m[3], m[4]]
      expect(a).toBe(b)
    }
  })

  /*
   * 키운 값이 44px을 만드는가.
   *
   * 글자 높이 16px에 위아래 14px씩이면 44px이다. 20px짜리는 12px씩이면 44px이다.
   * 값이 그보다 작으면 키운 시늉만 한 것이다.
   */
  it.each(BACK_LINKS)('$label 의 여백이 44px을 만든다', ({ file }) => {
    const src = readFileSync(file, 'utf8')
    const pads = [...src.matchAll(/py-\[(\d+)px\]/g)].map((m) => Number(m[1]))
    expect(pads.length).toBeGreaterThan(0)
    /* 글자 줄 높이가 16~20px이므로 12px 아래로는 44px이 안 나온다 */
    for (const p of pads) expect(p).toBeGreaterThanOrEqual(12)
  })
})
