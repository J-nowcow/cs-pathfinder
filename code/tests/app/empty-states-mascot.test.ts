import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 비어 있는 화면에도 두더지가 있어야 한다.
 *
 * 루트 404에는 이미 있었는데 나머지 막다른 길에는 없었다. 같은 서비스인데
 * 어떤 404는 마스코트가 맞아 주고 어떤 404는 검은 글씨만 있는 상태였다.
 *
 * 이 화면들은 **처음 온 사람의 첫 화면일 수 있다** — 카톡에서 주소가 잘려
 * 오는 경로가 실제로 있다. 그 자리에서 서비스의 인상이 정해진다.
 *
 * 마스코트는 정보가 아니라 장식이므로 낭독기에는 안 읽혀야 한다.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

const SCREENS = [
  { name: '없는 질문', path: 'src/app/(site)/q/[nodeId]/not-found.tsx' },
  { name: '없는 링크', path: 'src/app/(site)/t/[slug]/not-found.tsx' },
  { name: '검색 결과 없음', path: 'src/app/(site)/questions/page.tsx' },
]

describe('빈 화면의 마스코트', () => {
  for (const screen of SCREENS) {
    it(`${screen.name} 화면에 두더지가 있다`, () => {
      expect(read(screen.path)).toMatch(/\/mascot\/mole-/)
    })

    it(`${screen.name}의 두더지는 낭독기에 안 읽힌다`, () => {
      const src = read(screen.path)
      const block = src.slice(src.indexOf('/mascot/mole-') - 400, src.indexOf('/mascot/mole-') + 400)
      expect(block).toMatch(/alt=""/)
      expect(block).toMatch(/aria-hidden/)
    })
  }
})
