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
  it('다른 탭의 답안을 덮어쓰지 않고 현재 입력과 비교 화면을 유지한다', async () => {
    const user = userEvent.setup()
    render(<StudyPractice {...props} />)
    await user.type(screen.getByRole('textbox'), 'Original')
    const remote = JSON.parse(localStorage.getItem(LIBRARY_KEY)!)
    remote.entries[props.id].draft = 'Other tab draft'
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(remote))
    await user.type(screen.getByRole('textbox'), ' local edit')
    await user.click(screen.getByLabelText('근거 확인'))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Original local edit',
    )
    expect(
      JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries[props.id].draft,
    ).toBe('Other tab draft')
    expect(screen.getByRole('alert').textContent).toContain(
      '아직 저장되지 않은 답안',
    )
    await user.click(screen.getByText('저장된 답안과 비교하기'))
    expect(screen.getByText('Other tab draft')).toBeTruthy()
  })
  it('손상된 저장 내용을 지우지 않고 입력만 화면에 보존한다', async () => {
    const user = userEvent.setup()
    localStorage.setItem(LIBRARY_KEY, '{broken')
    render(<StudyPractice {...props} visit />)
    await user.type(screen.getByRole('textbox'), 'Keep my draft')
    expect(localStorage.getItem(LIBRARY_KEY)).toBe('{broken')
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Keep my draft',
    )
    expect(screen.getByRole('status').textContent).toContain(
      '기존 기록은 바꾸지 않았어요',
    )
  })
  it('같은 연습 화면에서 문제를 바꿨다가 돌아와도 미저장 답안을 유지한다', async () => {
    const user = userEvent.setup()
    const write = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation(() => {
        throw Error('quota')
      })
    const view = render(<StudyPractice {...props} />)
    await user.type(screen.getByRole('textbox'), 'Unsent answer')
    view.rerender(<StudyPractice {...props} id="topic:transactions" />)
    view.rerender(<StudyPractice {...props} />)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Unsent answer',
    )
    write.mockRestore()
  })
})
