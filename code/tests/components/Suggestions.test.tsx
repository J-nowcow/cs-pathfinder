// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suggestions } from '@/components/Suggestions'

afterEach(cleanup)

const suggestions = Array.from({ length: 5 }, (_, index) => ({
  id: `suggestion-${index + 1}`,
  text: `추천 꼬리질문 ${index + 1}?`,
  resolved: index === 0,
}))

describe('Suggestions', () => {
  it('추천 꼬리질문 5개를 모두 보여준다', () => {
    render(
      <Suggestions
        suggestions={suggestions}
        pendingId={null}
        disabled={false}
        onPick={() => {}}
      />,
    )

    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('선택한 카드 안에서 생성 중임을 분명히 보여준다', () => {
    const { container } = render(
      <Suggestions
        suggestions={suggestions}
        pendingId="suggestion-3"
        disabled
        onPick={() => {}}
      />,
    )

    const pending = screen.getByRole('button', { name: /추천 꼬리질문 3/ })
    expect(pending.getAttribute('data-pending')).toBe('true')
    expect(pending.textContent).toContain('새 질문과 해설을 만드는 중')
    expect(pending.className).toContain('border-accent')
    expect(pending.querySelector('.animate-spin')).toBeTruthy()
    expect(container.querySelectorAll('.animate-spin')).toHaveLength(1)
  })

  it('대기 중이 아니면 누른 질문을 그대로 넘긴다', async () => {
    const onPick = vi.fn()
    render(
      <Suggestions
        suggestions={suggestions}
        pendingId={null}
        disabled={false}
        onPick={onPick}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /추천 꼬리질문 2/ }))
    expect(onPick).toHaveBeenCalledWith(suggestions[1])
  })
})
