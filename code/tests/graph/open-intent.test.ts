import { describe, expect, it } from 'vitest'
import { wantsBrowserDefault } from '@/lib/graph/open-intent'

/**
 * 지도의 점을 눌렀을 때 시트를 열 것인가 브라우저에게 맡길 것인가.
 *
 * 하나라도 빠뜨리면 **사용자가 기대한 동작이 조용히 안 먹는다.** cmd+클릭이
 * 새 탭을 안 열면 사용자는 자기가 잘못 눌렀다고 생각하지, 그런 기능이 없다고
 * 생각하지 않는다.
 */
const click = (o: Partial<Parameters<typeof wantsBrowserDefault>[0]> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...o,
})

describe('wantsBrowserDefault', () => {
  it('평범한 왼쪽 클릭은 우리가 가로챈다', () => {
    expect(wantsBrowserDefault(click())).toBe(false)
  })

  it.each([
    ['cmd (맥)', { metaKey: true }],
    ['ctrl (윈도)', { ctrlKey: true }],
    ['shift (새 창)', { shiftKey: true }],
    ['alt (내려받기)', { altKey: true }],
  ])('%s 를 누르면 브라우저에게 맡긴다', (_, mod) => {
    expect(wantsBrowserDefault(click(mod))).toBe(true)
  })

  it('가운데 버튼은 브라우저에게 맡긴다', () => {
    expect(wantsBrowserDefault(click({ button: 1 }))).toBe(true)
  })

  it('오른쪽 버튼도 안 가로챈다', () => {
    expect(wantsBrowserDefault(click({ button: 2 }))).toBe(true)
  })

  it('여러 개를 같이 눌러도 맡긴다', () => {
    expect(wantsBrowserDefault(click({ metaKey: true, shiftKey: true }))).toBe(true)
  })
})
