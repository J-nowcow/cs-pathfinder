import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('약관과 개인정보 링크', () => {
  it.each(['privacy', 'terms'])('%s 화면의 모든 링크가 키보드 초점을 표시한다', (page) => {
    const source = readFileSync(`src/app/(site)/${page}/page.tsx`, 'utf8')
    const links = [...source.matchAll(/<a\b[\s\S]*?>/g)].map((match) => match[0])
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toContain('focus-visible:outline-2')
  })
})
