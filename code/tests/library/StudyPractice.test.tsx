// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudyPractice } from '@/components/library/StudyPractice'
import { LIBRARY_KEY } from '@/lib/library/storage'
beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
const props = {
  id: 'topic:normalization',
  title: '정규화',
  href: '/learn/engineer/normalization',
  track: 'engineer' as const,
  checklist: ['근거 확인'],
}
describe('새 답안 연습의 실패·재방문', () => {
  it('작성·체크·복습을 저장하고 다시 불러온다', async () => {
    const user = userEvent.setup()
    const view = render(<StudyPractice {...props} />)
    await user.type(screen.getByRole('textbox'), '내 답')
    await user.click(screen.getByLabelText('근거 확인'))
    await user.click(screen.getByRole('button', { name: '내일 다시 설명하기' }))
    view.unmount()
    render(<StudyPractice {...props} />)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      '내 답',
    )
    expect(
      (screen.getByLabelText('근거 확인') as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries[props.id].status,
    ).toBe('review')
  })
  it('저장 실패를 알리고 추가 체크를 눌러도 메모리의 초안을 잃지 않는다', async () => {
    const user = userEvent.setup()
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw Error('quota')
    })
    render(<StudyPractice {...props} />)
    await user.type(screen.getByRole('textbox'), '아직 보관 못한 답')
    await user.click(screen.getByLabelText('근거 확인'))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      '아직 보관 못한 답',
    )
    expect(screen.getByText(/저장하지 못했어요/)).toBeTruthy()
  })
})
