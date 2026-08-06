// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoteButton } from '@/components/VoteButton'

/**
 * 추천 버튼.
 *
 * 낙관적 갱신이 핵심이다. 왕복을 기다리는 동안 아무 반응이 없으면 안 눌린 줄
 * 알고 다시 누르고, 그러면 토글이 두 번 돌아 원래대로 돌아간다.
 *
 * 그리고 실패했을 때 조용히 되돌리면 안 된다. 눌렀다고 착각한 채 나간다.
 */
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mockFetch(impl: () => Promise<unknown>) {
  const spy = vi.fn(async () => {
    const body = await impl()
    return { ok: true, json: async () => body } as unknown as Response
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('VoteButton', () => {
  it('hides the count when nobody has voted', () => {
    render(<VoteButton slug="abc" initialCount={0} initialVoted={false} />)
    // 0이 박히면 죽은 서비스로 보인다
    expect(screen.getByRole('button').textContent).toBe('추천')
  })

  it('shows the count once there are votes', () => {
    render(<VoteButton slug="abc" initialCount={7} initialVoted={false} />)
    expect(screen.getByRole('button').textContent).toContain('7')
  })

  it('reflects the pressed state for assistive tech', () => {
    render(<VoteButton slug="abc" initialCount={1} initialVoted />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  /** 왕복 전에 화면이 먼저 움직여야 한다. 이게 이 컴포넌트의 존재 이유다 */
  it('moves before the server answers', async () => {
    let release: (v: unknown) => void = () => {}
    const pending = new Promise((r) => {
      release = r
    })
    mockFetch(async () => {
      await pending
      return { upvotes: 4, voted: true }
    })

    render(<VoteButton slug="abc" initialCount={3} initialVoted={false} />)
    await userEvent.click(screen.getByRole('button'))

    // 아직 서버는 답하지 않았다
    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toContain('4')
    })
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')

    release({})
  })

  /** 서버 숫자가 진짜다. 그 사이 다른 사람이 눌렀을 수 있다 */
  it('takes the server count as final', async () => {
    mockFetch(async () => ({ upvotes: 99, voted: true }))

    render(<VoteButton slug="abc" initialCount={3} initialVoted={false} />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button').textContent).toContain('99')
    })
  })

  it('toggles off and calls the same endpoint', async () => {
    const spy = mockFetch(async () => ({ upvotes: 0, voted: false }))

    render(<VoteButton slug="my-slug" initialCount={1} initialVoted />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
    })
    expect(spy).toHaveBeenCalledWith('/api/trees/my-slug/vote', { method: 'POST' })
  })

  /**
   * 실패하면 되돌리고 그 자리에서 말한다. 조용히 되돌리면 눌렀다고 착각한 채 나간다.
   */
  it('rolls back and says so when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false }) as unknown as Response),
    )

    render(<VoteButton slug="abc" initialCount={5} initialVoted={false} />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy()
    })
    expect(screen.getByRole('button').textContent).toContain('5')
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
  })

  it('rolls back when the network throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )

    render(<VoteButton slug="abc" initialCount={2} initialVoted />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy()
    })
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  /** 연타해도 요청은 하나다. 아니면 토글이 여러 번 돌아 결과를 예측할 수 없다 */
  it('ignores clicks while a request is in flight', async () => {
    let release: (v: unknown) => void = () => {}
    const pending = new Promise((r) => {
      release = r
    })
    const spy = mockFetch(async () => {
      await pending
      return { upvotes: 1, voted: true }
    })

    render(<VoteButton slug="abc" initialCount={0} initialVoted={false} />)
    const button = screen.getByRole('button')

    await userEvent.click(button)
    await userEvent.click(button)
    await userEvent.click(button)

    expect(spy).toHaveBeenCalledTimes(1)
    release({})
  })

  /** 카운터가 음수로 보이면 안 된다 */
  it('never shows a negative count', async () => {
    mockFetch(async () => ({ upvotes: 0, voted: false }))

    render(<VoteButton slug="abc" initialCount={0} initialVoted />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByRole('button').textContent).not.toContain('-')
    })
  })
})
