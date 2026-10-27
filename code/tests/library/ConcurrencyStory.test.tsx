// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConcurrencyStory } from '@/components/library/ConcurrencyStory'
afterEach(cleanup)
describe('교착의 원인을 비교해서 이해한다', () => {
  it('순서를 바꾸면 순환 대신 완료 가능한 보유자와 단방향 대기를 보여준다', async () => {
    render(<ConcurrencyStory />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      '서로 기다리는 순환',
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '같은 순서 A → B' }))
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      '대기의 순환이 없다',
    )
    expect(screen.getByText('A + B 보유')).toBeTruthy()
    expect(screen.getByText('보유 자원 없음')).toBeTruthy()
    expect(screen.queryByText('B를 기다림 →')).toBeNull()
    await user.click(screen.getByRole('button', { name: '서로 다른 순서' }))
    expect(screen.getByText('B를 기다림 →')).toBeTruthy()
    expect(screen.getByText('A 보유')).toBeTruthy()
    expect(screen.getByText('B 보유')).toBeTruthy()
  })
  it('답을 선택하기 전에는 정답을 표시하지 않고 오개념별 이유를 설명한다', async () => {
    render(<ConcurrencyStory />)
    expect(screen.queryByRole('status')).toBeNull()
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', { name: '그렇다. 기다리는 작업이 있으니까.' }),
    )
    expect(screen.getByRole('status').textContent).toContain(
      '대기가 있다는 사실만으로',
    )
    await user.click(
      screen.getByRole('button', {
        name: '아니다. T1이 끝낼 수 있는지 봐야 한다.',
      }),
    )
    expect(screen.getByRole('status').textContent).toContain(
      'T1이 잠금을 해제하면 T2도 진행',
    )
  })
})
