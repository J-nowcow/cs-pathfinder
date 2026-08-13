import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const page = readFileSync(
  new URL('../../src/app/(site)/questions/page.tsx', import.meta.url),
  'utf8',
)

describe('질문 목록의 모바일 분야 이동', () => {
  it('분야 칩을 한 줄로 스크롤해 본문을 여러 줄로 가리지 않는다', () => {
    expect(page).toContain('flex-nowrap')
    expect(page).toContain('overflow-x-auto')
    expect(page).toContain('sm:flex-wrap')
    expect(page).toContain('shrink-0 border-line')
    expect(page).toContain('scroll-mt-32')
  })
})
