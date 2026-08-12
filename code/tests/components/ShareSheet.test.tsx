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
    expect((screen.getByRole('button', { name: '닫기' }) as HTMLButtonElement).disabled).toBe(true)

    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('링크 생성 실패를 즉시 알린다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 503 }))
    render(<ShareSheet journey={journey()} />)
    await userEvent.click(screen.getByRole('button', { name: '공유' }))
    await userEvent.click(screen.getByRole('button', { name: '링크 만들기' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
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

  it('공유 버튼은 손끝으로 누르기 충분한 높이를 가진다', () => {
    render(<ShareSheet journey={journey()} />)
    expect(screen.getByRole('button', { name: '공유' }).className).toContain('min-h-11')
  })

  it('제목 입력이 빈 제목 안내를 설명으로 연결한다', async () => {
    render(<ShareSheet journey={journey()} />)
    await userEvent.click(screen.getByRole('button', { name: '공유' }))
    expect(screen.getByLabelText('제목').getAttribute('aria-describedby')).toBe('share-title-help')
  })

  it('완료 화면의 주소 입력란에 이름을 붙인다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{"url":"/t/shared-map"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    render(<ShareSheet journey={journey()} />)
    await userEvent.click(screen.getByRole('button', { name: '공유' }))
    await userEvent.click(screen.getByRole('button', { name: '링크 만들기' }))

    expect(await screen.findByRole('textbox', { name: '공유 주소' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '열어보기' }).getAttribute('rel')).toBe(
      'noopener noreferrer',
    )
  })
})
