// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TypographyPreferences } from '@/components/library/TypographyPreferences'
beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
const subject = () => (
  <div className="study-desk" data-typography="presentation">
    <TypographyPreferences />
  </div>
)
describe('서재의 글꼴 취향', () => {
  it('선택을 복원하고 기존 읽기 크기·답안·CS 테마는 보존한다', async () => {
    const records = {
      'pathfinder.library.v1': '원래 답안',
      'pathfinder.reading.v1': '{"version":1,"size":22}',
      'csqt.theme': 'dark',
    }
    Object.entries(records).forEach(([k, v]) => localStorage.setItem(k, v))
    const user = userEvent.setup(),
      view = render(subject())
    await user.click(
      screen.getByRole('radio', { name: '차분한 책 고운바탕 · SUIT' }),
    )
    expect(
      view.container.firstElementChild?.getAttribute('data-typography'),
    ).toBe('book')
    view.unmount()
    const next = render(subject())
    expect(
      next.container.firstElementChild?.getAttribute('data-typography'),
    ).toBe('book')
    Object.entries(records).forEach(([k, v]) =>
      expect(localStorage.getItem(k)).toBe(v),
    )
  })
  it('잘못된 저장값은 추천 조합으로 복구한다', () => {
    localStorage.setItem(
      'pathfinder.typography.v1',
      JSON.stringify({ version: 1, choice: 'url(bad)' }),
    )
    const view = render(subject())
    expect(
      view.container.firstElementChild?.getAttribute('data-typography'),
    ).toBe('presentation')
  })
  it('저장이 차단돼도 화면에는 적용한다', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw Error('blocked')
    })
    const view = render(subject())
    await userEvent
      .setup()
      .click(
        screen.getByRole('radio', { name: '부드러운 앱 LINE Seed · SUIT' }),
      )
    expect(
      view.container.firstElementChild?.getAttribute('data-typography'),
    ).toBe('friendly')
    expect(screen.getByRole('status').textContent).toContain(
      '저장하지 못했어요',
    )
  })
})
