import { describe, it, expect } from 'vitest'
import manifest from '@/app/manifest'

/**
 * 홈 화면에 추가할 수 있는가.
 *
 * **manifest가 있다고 설치가 되는 것이 아니다.** 크롬은 192px 이상 아이콘이
 * 하나도 없으면 설치를 권하지 않는다. 파일만 두고 "됐다"고 생각하기 쉬운
 * 자리라 조건을 시험으로 못 박는다.
 */
const m = manifest()

describe('manifest', () => {
  it('설치에 필요한 것이 다 있다', () => {
    expect(m.name).toBeTruthy()
    expect(m.short_name).toBeTruthy()
    expect(m.start_url).toBe('/')
    expect(m.display).toBe('standalone')
  })

  /* 크롬의 설치 최소 조건. 이게 빠지면 manifest가 있어도 안 뜬다 */
  it('192px 이상 아이콘이 있다', () => {
    const big = (m.icons ?? []).filter((i) => {
      const n = Number(String(i.sizes).split('x')[0])
      return n >= 192
    })
    expect(big.length).toBeGreaterThan(0)
  })

  it('512px과 maskable을 둘 다 준다', () => {
    const icons = m.icons ?? []
    expect(icons.some((i) => i.sizes === '512x512')).toBe(true)
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })

  /*
   * 뜨는 동안 보이는 색이 사이트 배경과 다르면 앱이 켜질 때 한 번 번쩍인다.
   * `globals.css`의 `--surface`와 같은 값이어야 한다.
   */
  it('배경색이 사이트 배경과 같다', () => {
    expect(m.background_color).toBe('#f3f5f6')
    expect(m.theme_color).toBe(m.background_color)
  })
})
