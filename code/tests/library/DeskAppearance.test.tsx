// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeskAppearance } from '@/components/library/DeskAppearance'
beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
const subject = () => (
  <div className="study-desk" data-appearance="light">
    <DeskAppearance />
  </div>
)
describe('서재의 밝기는 CS 설정과 따로 저장한다', () => {
  it('서재는 밝게 시작하고 선택을 복원하며 기존 CS 테마를 바꾸지 않는다', async () => {
    localStorage.setItem('csqt.theme', 'dark')
    document.documentElement.dataset.theme = 'dark'
    const view = render(subject())
    expect(
      view.container.firstElementChild?.getAttribute('data-appearance'),
    ).toBe('light')
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '어두운 서재로 보기' }))
    expect(
      view.container.firstElementChild?.getAttribute('data-appearance'),
    ).toBe('dark')
    view.unmount()
    const second = render(subject())
    expect(
      second.container.firstElementChild?.getAttribute('data-appearance'),
    ).toBe('dark')
    expect(localStorage.getItem('csqt.theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
  it('저장이 거절돼도 화면의 밝기는 바꾸고 저장 한계를 알린다', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw Error('blocked')
    })
    const view = render(subject())
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '어두운 서재로 보기' }))
    expect(
      view.container.firstElementChild?.getAttribute('data-appearance'),
    ).toBe('dark')
    expect(screen.getByRole('status').textContent).toContain(
      '저장하지 못했어요',
    )
  })
})
