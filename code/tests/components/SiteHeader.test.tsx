// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SiteHeader } from '@/components/SiteHeader'

/**
 * 헤더의 바깥으로 나가는 두 곳.
 *
 * 문의는 처음에 GitHub 이슈였다. 계정이 없으면 아예 못 쓴다는 것이 뒤늦게
 * 걸려서 메일로 바꿨다. 바뀐 게 주소 하나라 조용히 되돌아가기 쉬운 종류다.
 */
let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

afterEach(cleanup)

describe('SiteHeader · 바깥 링크', () => {
  /*
   * 문의는 글자다.
   *
   * 봉투 그림이었을 때 "눌러도 안 먹는다"는 말이 나왔다. 링크는 멀쩡했고,
   * 기본 메일 앱이 없으면 브라우저가 조용히 아무것도 안 하는 것이었다.
   * 그림으로는 "누르면 무언가 열린다"가 안 읽힌다.
   */
  it('문의는 글자로 보이고 눌러야 열린다', () => {
    render(<SiteHeader />)
    const btn = screen.getByRole('button', { name: '문의' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  /*
   * 두 갈래를 다 준다. GitHub 계정이 없는 사람도, 메일 앱이 없는 사람도
   * 막히지 않아야 한다. **주소는 글자로 보여준다** — mailto:만 걸어두면
   * 메일 앱이 없는 사람에게는 아무 일도 안 일어난다.
   */
  it('열면 GitHub 이슈와 메일 주소가 함께 나온다', async () => {
    render(<SiteHeader />)
    await userEvent.click(screen.getByRole('button', { name: '문의' }))

    expect(screen.getByRole('menuitem', { name: /GitHub/ }).getAttribute('href')).toContain(
      '/issues/new',
    )
    expect(screen.getByText('wkdgusdn0321@naver.com')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /메일 앱/ }).getAttribute('href')).toContain(
      'mailto:wkdgusdn0321@naver.com',
    )
  })

  /* 메일 주소로 새 탭을 열면 그 탭이 빈 화면으로 남아 사람이 직접 닫아야 한다 */
  it('메일은 새 탭을 열지 않는다', async () => {
    render(<SiteHeader />)
    await userEvent.click(screen.getByRole('button', { name: '문의' }))
    expect(screen.getByRole('menuitem', { name: /메일 앱/ }).getAttribute('target')).toBeNull()
  })

  /* 닫는 길이 없으면 한 번 연 사람이 갇힌다 */
  it('Esc로 닫힌다', async () => {
    render(<SiteHeader />)
    await userEvent.click(screen.getByRole('button', { name: '문의' }))
    expect(screen.getByRole('menu')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  /*
   * 새 창을 여는 링크에 noopener가 없으면 열린 쪽이 window.opener로 이 페이지를
   * 건드릴 수 있다.
   */
  it('저장소는 새 탭에서 열되 opener를 끊는다', () => {
    render(<SiteHeader />)
    const repo = screen.getByLabelText('GitHub에서 보기 (별을 눌러주세요)')
    expect(repo.getAttribute('target')).toBe('_blank')
    expect(repo.getAttribute('rel')).toContain('noopener')
  })
})

/**
 * 지금 있는 곳 표시.
 *
 * 홈을 `startsWith`로 판정하면 '/'가 모든 주소에 걸려 어디에 있든 홈이 켜진다.
 */
describe('SiteHeader · 현재 위치', () => {
  it('홈은 정확히 홈일 때만 켜진다', () => {
    pathname = '/questions'
    render(<SiteHeader />)
    expect(screen.getByText('오늘의 질문').getAttribute('aria-current')).toBeNull()
    expect(screen.getByText('질문 목록').getAttribute('aria-current')).toBe('page')
  })

  it('질문 화면에서도 하위 경로를 알아본다', () => {
    pathname = '/map/db'
    render(<SiteHeader />)
    expect(screen.getByText('지도').getAttribute('aria-current')).toBe('page')
  })
})
