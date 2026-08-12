// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { Sheet } from '@/components/GraphMap'

/**
 * 방금 넘어온 질문에 표시가 남는가.
 *
 * 시트의 "이어진 질문"은 부모와 자식을 **한 목록에 모은다.** 그래서 방금
 * 넘어온 질문이 늘 그 안에 섞여 있는데 구분이 없었다. 되돌아갈 곳을 찾으려면
 * 목록을 훑어 기억과 대조해야 했다.
 *
 * 표시를 테두리로만 하면 색과 모양을 못 보는 사람에게 아무것도 남지 않는다.
 * **글자로도 적혀 있어야 한다** — 그래서 테두리가 아니라 글자를 건다.
 */
const NODE = { id: 'cur', question: '커넥션 풀을 사용하는 이유는?' }
const LINKS = [
  { id: 'prev', question: 'DB 커넥션 비용이 큰 이유는?', reason: '앞에 알아야 한다' },
  { id: 'other', question: '스레드 풀을 쓰는 이유는?', reason: '같은 풀링이다' },
]

beforeEach(() => {
  // 시트는 마운트되며 해설을 받아온다. 이 시험의 관심사가 아니다
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"body":""}', { status: 200 })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const MARK = '← 방금 여기서 왔습니다'

/** 링크 하나가 그려진 버튼을 글자로 찾는다 */
function linkButton(question: string): HTMLElement {
  return screen.getByText(question).closest('button')!
}

describe('시트에서 이어진 질문을 눌러 옮겨왔을 때', () => {
  it('방금 온 질문에 글자로 표시를 남긴다', () => {
    render(<Sheet node={NODE} links={LINKS} cameFrom="prev" onClose={() => {}} onOpen={() => {}} />)
    expect(linkButton('DB 커넥션 비용이 큰 이유는?').textContent).toContain(MARK)
  })

  it('나머지 질문에는 남기지 않는다', () => {
    render(<Sheet node={NODE} links={LINKS} cameFrom="prev" onClose={() => {}} onOpen={() => {}} />)
    expect(linkButton('스레드 풀을 쓰는 이유는?').textContent).not.toContain(MARK)
  })

  /*
   * 글자와 함께 모양도 달라야 훑을 때 눈에 걸린다. 글자만 남고 점선이 빠지면
   * 목록을 죽 훑는 사람에게는 여전히 안 보인다. 둘은 같이 있어야 한다.
   */
  it('점선 테두리도 함께 준다', () => {
    render(<Sheet node={NODE} links={LINKS} cameFrom="prev" onClose={() => {}} onOpen={() => {}} />)
    expect(linkButton('DB 커넥션 비용이 큰 이유는?').className).toContain('border-dashed')
    expect(linkButton('스레드 풀을 쓰는 이유는?').className).not.toContain('border-dashed')
  })
})

/**
 * 지도의 점을 눌러 연 것은 **넘어온 것이 아니다.** 이때 앞서 남은 표시가
 * 그대로 있으면 오지도 않은 곳을 "방금 여기서 왔다"고 말하게 된다.
 */
describe('지도의 점을 눌러 열었을 때', () => {
  it('어느 질문에도 표시가 없다', () => {
    render(<Sheet node={NODE} links={LINKS} cameFrom={null} onClose={() => {}} onOpen={() => {}} />)
    expect(screen.queryByText(MARK)).toBeNull()
    expect(linkButton('DB 커넥션 비용이 큰 이유는?').className).not.toContain('border-dashed')
  })

  it('시트를 닫거나 질문을 읽는 버튼은 손끝 높이를 확보한다', () => {
    render(<Sheet node={NODE} links={LINKS} cameFrom={null} onClose={() => {}} onOpen={() => {}} />)
    expect(screen.getByRole('button', { name: '닫기' }).className).toContain('min-h-11')
    expect(screen.getByRole('link', { name: /질문 읽기/ }).className).toContain('min-h-11')
  })

  it('해설을 기다리는 동안 진행 상태와 로더를 보여준다', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    const { container } = render(
      <Sheet node={NODE} links={LINKS} cameFrom={null} onClose={() => {}} onOpen={() => {}} />,
    )
    expect(screen.getByRole('status').textContent).toContain('해설을 불러오는 중')
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })
})
