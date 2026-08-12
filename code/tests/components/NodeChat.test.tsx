// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NodeChat } from '@/components/NodeChat'

/**
 * 이 해설에 대해 물어보기.
 *
 * 접혀 있는 것이 기본이라는 것과, 고지(학습 사용·무저장)가 붙어 있다는
 * 것이 이 화면의 약속이다. 대화가 도는지는 fetch를 흉내 내 확인한다.
 */
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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
    expect(screen.getByText(/이 해설에 대해 물어보기/)).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('펼치면 입력과 고지가 나온다', async () => {
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByText(/이 해설에 대해 물어보기/))
    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(screen.getByText(/AI 학습에 쓰일 수 있습니다/)).toBeTruthy()
    expect(screen.getByText(/대화는 저장되지 않습니다/)).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('textbox'))
  })

  it('물어보면 내 말과 도우미 답이 순서대로 쌓인다', async () => {
    mockFetchOnce({ answer: '이렇게 보면 쉽습니다.', quota: { used: 1, limit: 30 } })
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByText(/이 해설에 대해 물어보기/))
    await user.type(screen.getByRole('textbox'), '쉽게 설명해 주세요')
    await user.click(screen.getByRole('button', { name: '물어보기' }))

    await waitFor(() => {
      expect(screen.getByText('쉽게 설명해 주세요')).toBeTruthy()
      expect(screen.getByText('이렇게 보면 쉽습니다.')).toBeTruthy()
    })
  })

  it('한도가 다하면 자정 안내가 나온다', async () => {
    mockFetchOnce({ error: 'quota_exceeded' }, 429)
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByText(/이 해설에 대해 물어보기/))
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
    await user.click(screen.getByText(/이 해설에 대해 물어보기/))
    await user.type(screen.getByRole('textbox'), '지워지면 안 됩니다')
    await user.click(screen.getByRole('button', { name: '물어보기' }))

    await waitFor(() => expect(screen.getByText(/답을 만들지 못했습니다/)).toBeTruthy())
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('지워지면 안 됩니다')
  })

  it('응답을 기다리는 동안 버튼에서 진행 상태를 보여준다', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise<Response>(() => {}))
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByText(/이 해설에 대해 물어보기/))
    await user.type(screen.getByRole('textbox'), '질문입니다')
    await user.click(screen.getByRole('button', { name: '물어보기' }))

    const button = await screen.findByRole('button', { name: /답변 중/ })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.querySelector('.animate-spin')).toBeTruthy()
  })

  it('Ctrl+Enter로도 제출한다', async () => {
    mockFetchOnce({ answer: '답입니다.', quota: { used: 1, limit: 30 } })
    const user = userEvent.setup()
    render(<NodeChat nodeId={NODE_ID} />)
    await user.click(screen.getByText(/이 해설에 대해 물어보기/))
    await user.type(screen.getByRole('textbox'), '키보드 질문')
    await user.keyboard('{Control>}{Enter}{/Control}')

    await waitFor(() => expect(screen.getByText('답입니다.')).toBeTruthy())
  })
})
