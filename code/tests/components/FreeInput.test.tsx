// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FreeInput } from '@/components/FreeInput'

/**
 * 자유 입력.
 *
 * 남은 횟수를 상시 보여주는 것이 요점이다. 다 쓰고 나서야 알려주면 그때는 늦다.
 * 그리고 거절당해도 입력을 지우지 않는다 — 다시 치게 하면 그 자리에서 이탈한다.
 */
afterEach(cleanup)

const base = {
  disabled: false,
  pending: false,
  quotaExceeded: false,
  remaining: 12,
  onSubmit: () => {},
}

describe('FreeInput — 남은 횟수', () => {
  it('shows how many are left', () => {
    render(<FreeInput {...base} />)
    expect(screen.getByText(/오늘 12번 남음/)).toBeTruthy()
  })

  /** 다 썼을 때는 남은 횟수 대신 왜 막혔는지를 말해야 한다 */
  it('replaces the count with a reason when spent', () => {
    render(<FreeInput {...base} quotaExceeded remaining={0} />)
    expect(screen.queryByText(/남음/)).toBeNull()
    expect(screen.getByText(/오늘 몫은 다 쓰셨어요/)).toBeTruthy()
  })

  it('keeps the privacy notice while there is room left', () => {
    render(<FreeInput {...base} />)
    expect(screen.getByText(/이름이나 연락처는 넣지 말아주세요/)).toBeTruthy()
  })
})

describe('FreeInput — 보낼 수 있는가', () => {
  it('starts disabled with an empty box', () => {
    render(<FreeInput {...base} />)
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
  })

  it('enables once something is typed', async () => {
    render(<FreeInput {...base} />)
    await userEvent.type(screen.getByRole('textbox'), '인덱스는 왜 안 타나')
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false)
  })

  it('stays disabled for whitespace only', async () => {
    render(<FreeInput {...base} />)
    await userEvent.type(screen.getByRole('textbox'), '    ')
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
  })

  it('blocks input entirely when the quota is spent', () => {
    render(<FreeInput {...base} quotaExceeded remaining={0} />)
    expect(screen.getByRole('textbox').hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
  })

  it('says what it is doing while a request runs', () => {
    render(<FreeInput {...base} pending />)
    expect(screen.getByRole('button').textContent).toBe('파는 중')
  })
})

describe('FreeInput — 길이', () => {
  it('counts characters as you type', async () => {
    // 셈과 남은 횟수가 같은 span 안에 나뉘어 있어 텍스트 조회로는 못 잡는다
    const { container } = render(<FreeInput {...base} />)
    await userEvent.type(screen.getByRole('textbox'), '아홉 글자다')

    const counter = container.querySelector('span.font-mono')
    expect(counter?.textContent).toContain('6/300')
  })

  /** 너무 길면 보내지 못하게 막고 셈이 경고색으로 바뀐다 */
  it('refuses to send an overlong question', async () => {
    render(<FreeInput {...base} />)
    const box = screen.getByRole('textbox')
    await userEvent.click(box)
    await userEvent.paste('가'.repeat(301))

    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true)
  })
})

describe('FreeInput — 제출', () => {
  it('hands over the trimmed text', async () => {
    const onSubmit = vi.fn()
    render(<FreeInput {...base} onSubmit={onSubmit} />)

    await userEvent.type(screen.getByRole('textbox'), '  격리 수준을 올리면?  ')
    await userEvent.click(screen.getByRole('button'))

    expect(onSubmit).toHaveBeenCalledWith('격리 수준을 올리면?')
  })

  /**
   * 여러 줄 입력이라 그냥 엔터는 줄바꿈이다. 제출은 조합키나 버튼이다.
   * 이걸 바꾸면 긴 질문을 쓰다가 중간에 제출되어 버린다.
   */
  it('does not submit on a bare enter', async () => {
    const onSubmit = vi.fn()
    render(<FreeInput {...base} onSubmit={onSubmit} />)

    await userEvent.type(screen.getByRole('textbox'), '한 줄{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits on meta+enter', async () => {
    const onSubmit = vi.fn()
    render(<FreeInput {...base} onSubmit={onSubmit} />)

    await userEvent.type(screen.getByRole('textbox'), '질문이다')
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}')

    expect(onSubmit).toHaveBeenCalledWith('질문이다')
  })

  /** 거절당해도 다시 치게 하면 그 자리에서 이탈한다 */
  it('keeps what was typed after submitting', async () => {
    render(<FreeInput {...base} onSubmit={() => {}} />)

    const box = screen.getByRole('textbox')
    await userEvent.type(box, '남아 있어야 한다')
    await userEvent.click(screen.getByRole('button'))

    expect((box as HTMLTextAreaElement).value).toBe('남아 있어야 한다')
  })
})
