// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReadingPreferences } from '@/components/library/ReadingPreferences'
beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.studySize
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
describe('본문 크기 설정', () => {
  it('선택한 크기를 저장하고 다음 방문에 적용하며 기존 답안을 건드리지 않는다', async () => {
    localStorage.setItem('pathfinder.library.v1', '보존할 원래 답안')
    const user = userEvent.setup()
    const view = render(<ReadingPreferences />)
    await user.click(screen.getByRole('button', { name: '더 크게' }))
    expect(document.documentElement.dataset.studySize).toBe('22')
    view.unmount()
    render(<ReadingPreferences />)
    expect(
      screen
        .getByRole('button', { name: '더 크게' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(localStorage.getItem('pathfinder.library.v1')).toBe(
      '보존할 원래 답안',
    )
  })
  it('잘못된 저장값은 기본 크기로 복구한다', () => {
    localStorage.setItem(
      'pathfinder.reading.v1',
      JSON.stringify({ version: 1, size: 999 }),
    )
    document.documentElement.dataset.studySize = '22'
    render(<ReadingPreferences />)
    expect(document.documentElement.dataset.studySize).toBe('18')
  })
  it('저장이 막혀도 크기 조절은 동작하고 저장 한계를 알린다', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw Error('blocked')
    })
    render(<ReadingPreferences />)
    await userEvent.setup().click(screen.getByRole('button', { name: '크게' }))
    expect(document.documentElement.dataset.studySize).toBe('20')
    expect(screen.getByRole('status').textContent).toContain(
      '저장하지 못했어요',
    )
  })
})
