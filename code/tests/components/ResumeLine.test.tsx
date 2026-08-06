// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, cleanup, screen, waitFor } from '@testing-library/react'
import { ResumeLine } from '@/components/ResumeLine'
import { startJourney, visit } from '@/lib/journey/path'
import { serializeJourney, JOURNEY_STORAGE_KEY } from '@/lib/journey/storage'

/**
 * 파던 자리로 돌아가는 줄.
 *
 * 재방문 장치가 0개였다. 판 기록은 이미 `localStorage`에 있는데 홈에 보여줄
 * 자리가 없었을 뿐이다.
 *
 * **안 보여야 할 때 안 보이는 것**이 이 시험의 절반이다. 처음 온 사람에게
 * 빈 상자가 뜨거나, 오늘 카드와 같은 곳을 가리키는 줄이 하나 더 생기면
 * 없느니만 못하다.
 */
const N = (id: string, question: string) => ({ id, question, category: '네트워크' })

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

/** A ─ B ─ C 를 판 상태. 현재 위치는 C다 */
function seedDepth(n: number) {
  let s = startJourney(N('A', '질문 A'))
  for (let i = 1; i < n; i += 1) {
    s = visit(s, s.currentId!, N(String.fromCharCode(65 + i), `질문 ${String.fromCharCode(65 + i)}`)).state
  }
  window.localStorage.setItem(JOURNEY_STORAGE_KEY, serializeJourney(s))
}

describe('ResumeLine', () => {
  it('두 칸 넘게 판 사람에게 마지막 질문을 보여준다', async () => {
    seedDepth(3)
    render(<ResumeLine />)
    await waitFor(() => expect(screen.getByText('질문 C')).toBeTruthy())
    expect(screen.getByRole('link').getAttribute('href')).toBe('/q/C')
  })

  it('깊이를 뿌리 기준으로 센다', async () => {
    seedDepth(3)
    render(<ResumeLine />)
    await waitFor(() => expect(screen.getByText(/깊이 2/)).toBeTruthy())
  })

  /* 처음 온 사람. 빈 상자가 뜨면 없느니만 못하다 */
  it('저장된 것이 없으면 아무것도 안 그린다', () => {
    const { container } = render(<ResumeLine />)
    expect(container.innerHTML).toBe('')
  })

  /*
   * 오늘의 질문을 열어 보기만 해도 발자국이 하나 생긴다. 그것까지 "파던 곳"이라
   * 부르면 바로 위 오늘 카드와 같은 곳을 가리키는 줄이 두 개가 된다.
   */
  it('한 칸만 판 사람에게는 안 보인다', async () => {
    seedDepth(1)
    const { container } = render(<ResumeLine />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container.innerHTML).toBe('')
  })

  it('저장된 값이 깨졌어도 안 죽는다', () => {
    window.localStorage.setItem(JOURNEY_STORAGE_KEY, '{ 망가진')
    const { container } = render(<ResumeLine />)
    expect(container.innerHTML).toBe('')
  })
})
