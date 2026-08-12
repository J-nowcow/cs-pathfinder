// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareSheet } from '@/components/ShareSheet'
import { startJourney, visit } from '@/lib/journey/path'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function journey() {
  const first = startJourney({ id: 'n1', question: '첫 질문은?', category: '네트워크' })
  return visit(first, first.currentId!, {
    id: 'n2',
    question: '둘째 질문은?',
    category: '네트워크',
  }).state
}

describe('ShareSheet', () => {
  it('열면 제목에 초점을 두고 Esc로 닫은 뒤 공유 버튼으로 돌아간다', async () => {
    const user = userEvent.setup()
    render(<ShareSheet journey={journey()} />)
    const trigger = screen.getByRole('button', { name: '공유' })
    await user.click(trigger)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('제목')))

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('링크를 만드는 동안 버튼에 로더와 진행 상태를 보여준다', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise<Response>(() => {}))
    const user = userEvent.setup()
    render(<ShareSheet journey={journey()} />)
    await user.click(screen.getByRole('button', { name: '공유' }))
    await user.click(screen.getByRole('button', { name: '링크 만들기' }))

    const pending = screen.getByRole('button', { name: /만드는 중/ })
    expect(pending.getAttribute('aria-busy')).toBe('true')
    expect(pending.querySelector('.animate-spin')).toBeTruthy()
  })

  it('Tab이 대화상자 밖으로 빠져나가지 않는다', async () => {
    const user = userEvent.setup()
    render(<ShareSheet journey={journey()} />)
    await user.click(screen.getByRole('button', { name: '공유' }))
    const title = screen.getByLabelText('제목')
    const make = screen.getByRole('button', { name: '링크 만들기' })

    make.focus()
    await user.keyboard('{Tab}')
    expect(document.activeElement).toBe(title)

    title.focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(document.activeElement).toBe(make)
  })
})
