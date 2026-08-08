// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { SiteFooter } from '@/components/SiteFooter'

/**
 * 개인정보처리방침으로 가는 길이 살아 있는가.
 *
 * 방침은 **찾을 수 있어야 뜻이 있다.** 만들어 두고 아무 데서도 안 걸어 두면
 * 없는 것과 같고, 개인정보 보호법 제30조는 "정보주체가 쉽게 확인할 수 있도록"
 * 공개하라고 한다.
 *
 * 바닥글은 모든 화면에 붙는다. 여기서 링크가 빠지면 서비스 전체에서 사라지는데
 * 화면은 멀쩡해 보인다 — 눈으로는 안 잡히는 회귀다.
 */
afterEach(cleanup)

describe('바닥글', () => {
  it('개인정보처리방침으로 가는 길이 있다', () => {
    render(<SiteFooter />)
    const link = screen.getByText('개인정보처리방침')
    expect(link.getAttribute('href')).toBe('/privacy')
  })
})
