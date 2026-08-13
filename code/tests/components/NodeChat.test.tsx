// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NodeChat } from '@/components/NodeChat'

const originalScrollIntoView = Element.prototype.scrollIntoView

/**
 * 이 해설에 대해 물어보기.
 *
 * 접혀 있는 것이 기본이라는 것과, 고지(학습 사용·무저장)가 붙어 있다는
 * 것이 이 화면의 약속이다. 대화가 도는지는 fetch를 흉내 내 확인한다.
 */
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  if (originalScrollIntoView) Element.prototype.scrollIntoView = originalScrollIntoView
  else delete (Element.prototype as { scrollIntoView?: Element['scrollIntoView'] }).scrollIntoView
})

const NODE_ID = '00000000-0000-4000-8000-000000000001'

function mockFetchOnce(payload: unknown, status = 200) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('NodeChat', () => {
  it('처음에는 접혀 있고 여는 문이 보인다', () => {
    render(<NodeChat nodeId={NODE_ID} />)
    const trigger = screen.getByRole('button', { name: '해설 질문 열기' })
    expect(trigger.className).toContain('fixed')
    expect(trigger.className).toContain('right-4')
    expect(trigger.className).toContain('xl:right-0')
    expect(trigger.getAttribute('aria-controls')).toBe('node-chat-dialog')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('펼치면 입력과 고지가 나온다', async () => {
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    const dialog = screen.getByRole('dialog', { name: '이 해설에 대해 물어보기' })
    expect(dialog.className).toContain('flex')
    expect(dialog.className).toContain('overflow-hidden')
    const backdrop = screen.getByRole('button', { name: '해설 질문 닫기' })
    expect(backdrop.className).toContain('xl:hidden')
    expect(screen.getByRole('textbox').closest('form')?.className).toContain('shrink-0')
    expect(screen.getByText(/AI 학습에 쓰일 수 있습니다/)).toBeTruthy()
    expect(screen.getByText(/대화는 저장되지 않습니다/)).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('textbox'))
    expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBe(
      'node-chat-count node-chat-notice',
    )
  })

  it('접은 뒤 다시 여는 버튼으로 초점이 돌아간다', async () => {
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    await user.click(screen.getByRole('button', { name: '접기' }))

    const trigger = screen.getByRole('button', { name: '해설 질문 열기' })
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('Escape로 패널을 닫고 여는 탭으로 초점을 돌린다', async () => {
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    await user.keyboard('{Escape}')

    const trigger = screen.getByRole('button', { name: '해설 질문 열기' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('물어보면 내 말과 도우미 답이 순서대로 쌓인다', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    mockFetchOnce({ answer: '이렇게 보면 쉽습니다.', quota: { used: 1, limit: 30 } })
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    await user.type(screen.getByRole('textbox'), '쉽게 설명해 주세요')
    await user.click(screen.getByRole('button', { name: '물어보기' }))

    await waitFor(() => {
      expect(screen.getByText('쉽게 설명해 주세요')).toBeTruthy()
      expect(screen.getByText('이렇게 보면 쉽습니다.')).toBeTruthy()
    })
    expect(screen.getByRole('log').getAttribute('aria-live')).toBe('polite')
    expect(screen.getByRole('log').parentElement?.className).toContain('overflow-y-auto')
    expect(screen.getByLabelText('내 질문').textContent).toBe('쉽게 설명해 주세요')
    expect(screen.getByLabelText('답변').textContent).toBe('이렇게 보면 쉽습니다.')
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
  })

  it('한도가 다하면 자정 안내가 나온다', async () => {
    mockFetchOnce({ error: 'quota_exceeded' }, 429)
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    await user.type(screen.getByRole('textbox'), '질문입니다')
    await user.click(screen.getByRole('button', { name: '물어보기' }))

    await waitFor(() => {
      expect(screen.getByText(/자정에 다시 채워집니다/)).toBeTruthy()
    })
  })

  it('응답에 실패하면 입력을 남겨 다시 보낼 수 있게 한다', async () => {
    mockFetchOnce({ error: 'failed' }, 500)
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    await user.type(screen.getByRole('textbox'), '지워지면 안 됩니다')
    await user.click(screen.getByRole('button', { name: '물어보기' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('alert').textContent).toContain('답을 만들지 못했습니다')
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('지워지면 안 됩니다')
  })

  it('실패한 질문을 다시 보내도 대화에 두 번 쌓이지 않는다', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{"error":"failed"}', { status: 500 }))
      .mockResolvedValueOnce(
        new Response('{"answer":"다시 받은 답입니다.","quota":{"used":1,"limit":30}}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    await user.type(screen.getByRole('textbox'), '한 번만 보여야 합니다')
    await user.click(screen.getByRole('button', { name: '물어보기' }))
    await waitFor(() => expect(screen.getByText(/답을 만들지 못했습니다/)).toBeTruthy())

    await user.click(screen.getByRole('button', { name: '물어보기' }))
    await waitFor(() => expect(screen.getByText('다시 받은 답입니다.')).toBeTruthy())

    expect(screen.getAllByText('한 번만 보여야 합니다')).toHaveLength(1)
  })

  it('응답을 기다리는 동안 버튼에서 진행 상태를 보여준다', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise<Response>(() => {}))
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    await user.type(screen.getByRole('textbox'), '질문입니다')
    await user.click(screen.getByRole('button', { name: '물어보기' }))

    const button = await screen.findByRole('button', { name: /답변 중/ })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.querySelector('.animate-spin')).toBeTruthy()
  })

  it('다른 질문으로 떠나면 남아 있던 요청을 취소한다', async () => {
    let signal: AbortSignal | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_, init) => {
      signal = init?.signal as AbortSignal
      return new Promise<Response>(() => {})
    })
    const user = userEvent.setup()
    const view = render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    await user.type(screen.getByRole('textbox'), '질문입니다')
    await user.click(screen.getByRole('button', { name: '물어보기' }))

    view.unmount()
    expect(signal?.aborted).toBe(true)
  })

  it('물어보기 버튼은 키보드 초점을 표시한다', async () => {
    render(<NodeChat nodeId={NODE_ID} />)
    await userEvent.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    expect(screen.getByRole('button', { name: '물어보기' }).className).toContain(
      'focus-visible:outline-2',
    )
  })

  it('너무 긴 입력을 오류 상태로 알린다', async () => {
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    const textbox = screen.getByRole('textbox')
    await user.click(textbox)
    await user.paste('가'.repeat(301))

    expect(textbox.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('button', { name: '물어보기' }).hasAttribute('disabled')).toBe(true)
  })

  it('Ctrl+Enter로도 제출한다', async () => {
    mockFetchOnce({ answer: '답입니다.', quota: { used: 1, limit: 30 } })
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByRole('button', { name: '해설 질문 열기' }))
    await user.type(screen.getByRole('textbox'), '키보드 질문')
    await user.keyboard('{Control>}{Enter}{/Control}')

    await waitFor(() => expect(screen.getByText('답입니다.')).toBeTruthy())
  })
})
