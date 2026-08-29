// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { AuthMenu } from '@/components/AuthMenu'

/**
 * 서버가 그린 것과 브라우저의 첫 그림이 같아야 한다.
 *
 * 세션 확인은 브라우저에서만 된다. 서버는 누가 로그인했는지 모르고,
 * 브라우저는 저장된 세션을 즉시 알 수 있다. 이 둘이 다르면 리액트가
 * 하이드레이션에 실패하고 **화면 전체를 다시 그린다** — 서버에서 그린
 * 것이 통째로 버려지고, 콘솔에는 복구되지 않는 오류가 남는다.
 *
 * 그래서 첫 그림은 세션 상태와 무관하게 자리표시자로 고정한다.
 * 계정 아이콘은 붙은 뒤에 나타난다.
 */
const state = vi.hoisted(() => ({
  session: null as null | { user: { email: string } },
  isPending: false,
}))

vi.mock('@/lib/auth/client', () => ({
  authClient: {
    useSession: () => ({ data: state.session, isPending: state.isPending }),
    signOut: vi.fn(async () => {}),
    signIn: { social: vi.fn(async () => {}) },
  },
}))

beforeEach(() => {
  state.session = null
  state.isPending = false
})
afterEach(cleanup)

describe('AuthMenu · 서버와 첫 그림', () => {
  it('세션을 이미 아는 상태여도 서버 렌더는 자리표시자다', () => {
    state.session = { user: { email: 'me@example.com' } }
    const html = renderToStaticMarkup(<AuthMenu />)
    expect(html).not.toContain('내 계정')
    expect(html).toContain('aria-hidden')
  })

  it('로그인 전이어도 서버 렌더는 자리표시자다', () => {
    const html = renderToStaticMarkup(<AuthMenu />)
    expect(html).not.toContain('Google로 로그인')
  })

  it('붙은 뒤에는 계정 아이콘이 나타난다', async () => {
    state.session = { user: { email: 'me@example.com' } }
    render(<AuthMenu />)
    await waitFor(() => expect(screen.getByLabelText('내 계정')).toBeTruthy())
  })
})
