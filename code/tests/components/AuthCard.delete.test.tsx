// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthCard } from '@/components/AuthCard'

/**
 * 계정 삭제.
 *
 * 되돌릴 수 없는 유일한 버튼이다. 그래서 두 가지를 고정한다 —
 * **한 번 눌러서는 아무 일도 안 일어난다**는 것과, **무슨 일이
 * 일어났는지 그 자리에서 말한다**는 것.
 *
 * 확인을 native confirm으로 띄우면 안 된다. 문구를 우리가 못 고르고,
 * 브라우저에 따라 "이 사이트가 다시 묻지 않게 하기"로 통째로 꺼지며,
 * 그러면 첫 클릭이 곧 삭제가 된다.
 */
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn(async () => {}) }))

vi.mock('@/lib/auth/client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { email: 'me@example.com' } }, isPending: false }),
    signOut,
    signIn: { social: vi.fn() },
  },
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  signOut.mockClear()
})

/** 응답 코드만 다르게 주는 fetch */
function mockFetch(ok: boolean) {
  const spy = vi.fn(async () => ({ ok, status: ok ? 200 : 401 }) as unknown as Response)
  vi.stubGlobal('fetch', spy)
  return spy
}

const openConfirm = async () => {
  await userEvent.click(screen.getByRole('button', { name: '계정 삭제' }))
}

describe('AuthCard · 계정 삭제', () => {
  /** 첫 클릭이 곧 삭제이면, 오조작 한 번에 기록이 사라진다 */
  it('첫 클릭에는 아무것도 안 지우고 확인을 묻는다', async () => {
    const spy = mockFetch(true)
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmSpy)

    render(<AuthCard />)
    await openConfirm()

    expect(spy).not.toHaveBeenCalled()
    // 브라우저 기본 대화상자가 아니라 우리 화면 안에서 묻는다
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '지우기' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '취소' })).toBeTruthy()
  })

  /**
   * 무엇이 지워지고 무엇이 안 지워지는지를 묻는 자리에서 말한다.
   * 이 기기의 로컬 기록은 남는데, 그걸 안 적으면 "다 지웠다"로 읽힌다.
   */
  it('확인 문구가 지워지는 것과 남는 것을 함께 밝힌다', async () => {
    mockFetch(true)
    render(<AuthCard />)
    await openConfirm()

    expect(screen.getByText(/서버에 저장된 이메일과 학습 기록이 지워집니다/)).toBeTruthy()
    expect(screen.getByText(/이 브라우저에 남은 기록은 지워지지 않습니다/)).toBeTruthy()
  })

  it('취소하면 확인이 닫히고 아무 요청도 안 나간다', async () => {
    const spy = mockFetch(true)
    render(<AuthCard />)
    await openConfirm()
    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(spy).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '지우기' })).toBeNull()
  })

  it('확인하면 탈퇴 엔드포인트로 POST한다', async () => {
    const spy = mockFetch(true)
    render(<AuthCard />)
    await openConfirm()
    await userEvent.click(screen.getByRole('button', { name: '지우기' }))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        '/api/auth/delete-user',
        expect.objectContaining({ method: 'POST', body: '{}' }),
      )
    })
  })

  /**
   * 성공 안내는 로그아웃보다 오래 남아야 한다. signOut이 세션을 비우면
   * 카드가 로그인 화면으로 되돌아가는데, 그때 안내까지 같이 사라지면
   * 사람은 지워졌는지 아닌지 모른 채 남는다.
   */
  it('성공하면 지웠다고 말하고 로그아웃까지 한다', async () => {
    mockFetch(true)
    render(<AuthCard />)
    await openConfirm()
    await userEvent.click(screen.getByRole('button', { name: '지우기' }))

    await waitFor(() => {
      expect(screen.getByText(/계정을 지웠습니다/)).toBeTruthy()
    })
    expect(signOut).toHaveBeenCalled()
    // 지운 뒤에 삭제 버튼이 남아 있으면 또 누른다
    expect(screen.queryByRole('button', { name: '계정 삭제' })).toBeNull()
  })

  /** 조용히 실패하면 지워진 줄 알고 나간다 */
  it('실패하면 그 자리에서 말하고 다시 해볼 길을 남긴다', async () => {
    mockFetch(false)
    render(<AuthCard />)
    await openConfirm()
    await userEvent.click(screen.getByRole('button', { name: '지우기' }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/다시 로그인한 뒤 시도해 주세요/)
    })
    expect(screen.queryByText(/계정을 지웠습니다/)).toBeNull()
    expect(screen.getByRole('button', { name: '지우기' })).toBeTruthy()
  })

  it('연결이 끊겨도 같은 자리에서 말한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    render(<AuthCard />)
    await openConfirm()
    await userEvent.click(screen.getByRole('button', { name: '지우기' }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy()
    })
    expect(signOut).not.toHaveBeenCalled()
  })

  /** 연타하면 요청이 여러 번 나가고, 두 번째부터는 세션이 없어 실패로 보인다 */
  it('보내는 동안 다시 눌러도 요청은 하나다', async () => {
    let release: (v: unknown) => void = () => {}
    const pending = new Promise((r) => {
      release = r
    })
    const spy = vi.fn(async () => {
      await pending
      return { ok: true, status: 200 } as unknown as Response
    })
    vi.stubGlobal('fetch', spy)

    render(<AuthCard />)
    await openConfirm()
    const confirmButton = screen.getByRole('button', { name: '지우기' })
    await userEvent.click(confirmButton)
    await userEvent.click(confirmButton)
    await userEvent.click(confirmButton)

    expect(spy).toHaveBeenCalledTimes(1)
    release({})
  })

  /** 폰에서 누를 수 있어야 한다 — 카드 안의 다른 버튼과 같은 규칙 */
  it('삭제 버튼도 터치 크기를 지킨다', () => {
    render(<AuthCard />)
    expect(screen.getByRole('button', { name: '계정 삭제' }).className).toContain('min-h-11')
  })
})
