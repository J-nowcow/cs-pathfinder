// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PathChips } from '@/components/PathChips'
import type { Occurrence } from '@/lib/journey/types'

/**
 * 위쪽 경로 줄.
 *
 * "어디를 거쳐 왔는지"를 말하는 자리다. 거쳐 온 곳이 없으면 할 말이 없는데
 * 전에는 그때도 칩을 하나 그렸다. 그 칩은 바로 아래 제목과 **글자 그대로 같은
 * 문장**이었고, 누르면 지금 있는 자리로 갔다. 공유 링크와 오늘의 질문이 전부
 * 그 상태로 열리므로 첫 화면에서 늘 보이던 중복이다.
 */
const occ = (id: string, question: string, parentId: string | null = null): Occurrence => ({
  id,
  nodeId: `n-${id}`,
  parentId,
  question,
  category: '네트워크',
})

afterEach(cleanup)

describe('PathChips', () => {
  it('아직 한 칸도 안 팠으면 그리지 않는다', () => {
    const { container } = render(
      <PathChips path={[occ('a', 'TCP 연결을 끊을 때 TIME_WAIT이 필요한 이유는?')]} onJump={() => {}} />,
    )
    expect(container.querySelector('nav')).toBeNull()
  })

  it('경로가 비어도 그리지 않는다', () => {
    const { container } = render(<PathChips path={[]} onJump={() => {}} />)
    expect(container.querySelector('nav')).toBeNull()
  })

  /* 부모가 생기는 순간부터 뜻이 산다 */
  it('한 칸이라도 팠으면 거쳐 온 곳을 다 보여준다', () => {
    render(
      <PathChips
        path={[occ('a', '질문 A'), occ('b', '질문 B', 'a')]}
        onJump={() => {}}
      />,
    )
    expect(screen.getByText('질문 A')).toBeTruthy()
    expect(screen.getByText('질문 B')).toBeTruthy()
  })

  it('앞선 칩을 누르면 그 자리로 보낸다', async () => {
    const onJump = vi.fn()
    render(
      <PathChips path={[occ('a', '질문 A'), occ('b', '질문 B', 'a')]} onJump={onJump} />,
    )
    await userEvent.click(screen.getByText('질문 A'))
    expect(onJump).toHaveBeenCalledWith('a')
  })

  it('보이는 칩보다 넓은 손끝 판정 영역을 유지한다', () => {
    render(
      <PathChips path={[occ('a', '질문 A'), occ('b', '질문 B', 'a')]} onJump={() => {}} />,
    )
    const button = screen.getByRole('button', { name: '질문 A' })
    expect(button.className).toContain('before:-inset-y-2')
  })

  /*
   * 깊이가 쌓이면 가운데를 접는다. 뿌리와 최근 몇 걸음이 방향을 잡는 데
   * 필요한 전부다.
   */
  it('깊어지면 가운데를 접는다', () => {
    const path = [occ('r', '뿌리')]
    for (let i = 1; i <= 6; i++) path.push(occ(`n${i}`, `질문 ${i}`, path[i - 1].id))

    render(<PathChips path={path} onJump={() => {}} />)
    expect(screen.getByText('뿌리')).toBeTruthy()
    expect(screen.getByText('⋯')).toBeTruthy()
    expect(screen.queryByText('질문 2')).toBeNull()
    expect(screen.getByText('질문 6')).toBeTruthy()
  })
})
