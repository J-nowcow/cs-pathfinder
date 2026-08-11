// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthMenu } from '@/components/AuthMenu'

/**
 * 머리글의 계정 자리.
 *
 * 지키려는 것은 둘이다. **한 번 눌러서 로그아웃되지 않는 것** — 되돌리려면
 * 구글 화면을 다시 거쳐야 하는 일이라 오조작 대가가 크다. 그리고 **세션을
 * 확인하는 동안 자리가 흔들리지 않는 것** — 이 줄은 폰에서 여유가 11px뿐이라
 * 아이콘이 뒤늦게 튀어나오면 옆 항목이 밀린다.
 */
const state = vi.hoisted(() => ({
  session: null as null | { user: { email: string } },
  isPending: false,
}))
const { signOut, social } = vi.hoisted(() => ({
  signOut: vi.fn(async () => {}),
  social: vi.fn(async () => {}),
}))

vi.mock('@/lib/auth/client', () => ({
  authClient: {
    useSession: () => ({ data: state.session, isPending: state.isPending }),
    signOut,
    signIn: { social },
  },
}))

beforeEach(() => {
  state.session = null
  state.isPending = false
  signOut.mockClear()
  social.mockClear()
})
afterEach(cleanup)

const login = () => {
  state.session = { user: { email: 'me@example.com' } }
}

describe('AuthMenu · 로그인 전', () => {
  /* 그림뿐이라 낭독기에는 이름이 안 보인다. aria-label이 유일한 이름이다 */
  it('사람 그림에 이름을 남긴다', () => {
    render(<AuthMenu />)
    expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
  })

  it('누르면 구글 로그인을 시작한다', async () => {
    render(<AuthMenu />)
    await userEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
    expect(social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/me' })
  })

  /* 로그인 전에 열 메뉴는 없다. 구글 하나뿐이라 고를 것이 없다 */
  it('메뉴를 열지 않는다', async () => {
    render(<AuthMenu />)
    await userEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('AuthMenu · 로그인 후', () => {
  it('누르기 전에는 메뉴가 닫혀 있다', () => {
    login()
    render(<AuthMenu />)
    const btn = screen.getByRole('button', { name: '내 계정' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  /**
   * 아이콘에 로그아웃을 바로 걸면 잘못 눌러서 로그아웃된다. 구글 화면을
   * 다시 거쳐야 돌아오는 일이라 한 번 물어보는 값을 한다.
   */
  it('한 번 눌러서는 로그아웃되지 않는다', async () => {
    login()
    render(<AuthMenu />)
    await userEvent.click(screen.getByRole('button', { name: '내 계정' }))
    expect(signOut).not.toHaveBeenCalled()
  })

  /* 계정이 둘인 사람은 이걸 안 보면 엉뚱한 계정에 기록을 쌓는다 */
  it('어느 계정인지 밝힌다', async () => {
    login()
    render(<AuthMenu />)
    await userEvent.click(screen.getByRole('button', { name: '내 계정' }))
    expect(screen.getByText('me@example.com')).toBeTruthy()
  })

  it('내 기록으로 가는 길과 로그아웃을 함께 준다', async () => {
    login()
    render(<AuthMenu />)
    await userEvent.click(screen.getByRole('button', { name: '내 계정' }))
    expect(screen.getByRole('menuitem', { name: '내 기록으로' }).getAttribute('href')).toBe('/me')
    expect(screen.getByRole('menuitem', { name: '로그아웃' })).toBeTruthy()
  })

  it('메뉴에서 누르면 로그아웃한다', async () => {
    login()
    render(<AuthMenu />)
    await userEvent.click(screen.getByRole('button', { name: '내 계정' }))
    await userEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }))
    expect(signOut).toHaveBeenCalled()
  })

  /* 닫는 길이 없으면 한 번 연 사람이 갇힌다 — ContactMenu와 같은 규칙 */
  it('Esc로 닫힌다', async () => {
    login()
    render(<AuthMenu />)
    const trigger = screen.getByRole('button', { name: '내 계정' })
    await userEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeTruthy()
    screen.getByRole('menuitem', { name: '내 기록으로' }).focus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('바깥을 누르면 닫힌다', async () => {
    login()
    render(<AuthMenu />)
    await userEvent.click(screen.getByRole('button', { name: '내 계정' }))
    await userEvent.click(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('AuthMenu · 자리 잡기', () => {
  /**
   * 확인하는 동안 아무것도 안 그리면, 끝나는 순간 아이콘이 튀어나오며
   * 옆 항목이 밀린다. 폰에서 이 줄의 여유는 11px뿐이라 그대로 보인다.
   */
  it('세션을 확인하는 동안에도 자리를 차지한다', () => {
    state.isPending = true
    const { container } = render(<AuthMenu />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('.w-8')).toBeTruthy()
  })

  /* 폰에서 손끝이 닿아야 한다 — 머리글의 다른 항목과 같은 규칙 */
  it('누르는 자리가 44px다', () => {
    render(<AuthMenu />)
    expect(screen.getByRole('button', { name: 'Google로 로그인' }).className).toContain('h-11')
  })
})
