// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Grass } from '@/components/Grass'
import type { Cell } from '@/lib/streak/grass'

/**
 * 칸을 누르면 그 날짜의 편수가 보인다.
 *
 * title 속성은 폰 터치에서 아무것도 안 띄운다 — 누르는 길이 없으면
 * 폰 사용자는 날짜별 숫자를 영영 못 본다. 클릭 표시를 지우면 여기서
 * 잡힌다. 같은 칸을 다시 누르면 닫히는 것도 약속이다.
 */
const CELL: Cell = { day: '2026-08-09', count: 2, level: 2 }
const WEEKS: Array<Array<Cell | null>> = [[CELL, null]]

afterEach(cleanup)

describe('잔디 칸 누르기', () => {
  it('누르면 날짜와 편수가 나타나고, 다시 누르면 닫힌다', async () => {
    const user = userEvent.setup()
    const { container, queryByText } = render(<Grass weeks={WEEKS} summary="요약 문장" />)

    const cell = container.querySelector('button')!
    await user.click(cell)
    expect(queryByText(/2026년 8월 9일/)).toBeTruthy()
    expect(queryByText(/2편 파고들었습니다/)).toBeTruthy()

    await user.click(cell)
    expect(queryByText(/2026년 8월 9일/)).toBeNull()
  })

  it('낭독기용 요약 문장은 그대로 남는다', () => {
    const { getByText } = render(<Grass weeks={WEEKS} summary="요약 문장" />)
    expect(getByText('요약 문장')).toBeTruthy()
  })

  it('칸이 키보드 순회에 들어가지 않는다 — aria-hidden 격자 안이라서', () => {
    const { container } = render(<Grass weeks={WEEKS} summary="요약 문장" />)
    expect(container.querySelector('button')!.tabIndex).toBe(-1)
  })
})
