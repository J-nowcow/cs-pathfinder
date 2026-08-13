// @vitest-environment happy-dom
import { StrictMode } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Prose } from '@/components/Prose'

/**
 * 답 블록.
 *
 * 생성 규칙이 "답 먼저 → 도식 → 근거"라 첫 문단이 곧 답이다. 렌더러가 그
 * 문단만 다르게 그린다 — 저장된 본문은 한 글자도 안 고친다.
 *
 * **번호가 아니라 종류로 찾는 것**이 이 시험의 요점이다. `blocks[0]`으로
 * 잡으면 모델이 도식이나 표를 먼저 놓은 본문에서 리드가 통째로 사라지거나
 * 도식에 문단 스타일이 붙는다. 실제 저장분에 도식이 먼저 오는 글이 있으므로
 * 가정이 아니라 일어나는 일이다.
 */
afterEach(cleanup)

const leads = (root: Element) => [...root.querySelectorAll('.prose-lead')]

describe('Prose — 답 블록', () => {
  it('첫 문단에 리드를 붙인다', () => {
    const { container } = render(<Prose body={'답이다.\n\n근거다.\n\n덧붙임이다.'} />)

    const found = leads(container)
    expect(found).toHaveLength(1)
    expect(found[0].textContent).toBe('답이다.')
  })

  /* 리드는 하나뿐이어야 한다. 여럿이면 강조가 강조가 아니다 */
  it('뒤 문단에는 안 붙인다', () => {
    const { container } = render(<Prose body={'답이다.\n\n근거다.'} />)

    const paragraphs = [...container.querySelectorAll('p')]
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].className).toContain('prose-lead')
    expect(paragraphs[1].className).not.toContain('prose-lead')
  })

  /**
   * 도식이 먼저 오는 본문.
   *
   * 여기서 `blocks[0]`은 문단이 아니다. 처음 나오는 **문단**을 찾아야
   * 리드가 살아남는다.
   */
  it('도식이 먼저 와도 첫 문단이 리드다', () => {
    const { container } = render(
      <Prose
        body={[
          ':::flow',
          '소스 -> 컴파일러: 기계어로 바꾼다',
          '컴파일러 -> 링커: 실행 파일을 만든다',
          ':::',
          '',
          '도식 뒤에 오는 답이다.',
          '',
          '그다음 근거다.',
        ].join('\n')}
      />,
    )

    const found = leads(container)
    expect(found).toHaveLength(1)
    expect(found[0].textContent).toBe('도식 뒤에 오는 답이다.')
  })

  /* 도식 안에도 p가 있다. 거기에 붙으면 도식 한 줄만 커진다 */
  it('도식 안의 문단은 리드가 아니다', () => {
    const { container } = render(
      <Prose
        body={[':::flow', 'A -> B: 하나', 'B -> C: 둘', ':::', '', '바깥 문단이다.'].join('\n')}
      />,
    )

    const figure = container.querySelector('figure')!
    expect(figure.querySelectorAll('.prose-lead')).toHaveLength(0)
    expect(leads(container)).toHaveLength(1)
  })

  it('표가 먼저 와도 첫 문단이 리드다', () => {
    const { container } = render(
      <Prose
        body={[
          '| 기준 | 낙관적 | 비관적 |',
          '| --- | --- | --- |',
          '| 충돌 | 드물다 | 잦다 |',
          '',
          '표 뒤에 오는 답이다.',
        ].join('\n')}
      />,
    )

    const found = leads(container)
    expect(found).toHaveLength(1)
    expect(found[0].textContent).toBe('표 뒤에 오는 답이다.')
  })

  /* 문단이 없으면 붙일 곳이 없다. -1이 0번 블록으로 새면 안 된다 */
  it('문단이 하나도 없으면 아무 데도 안 붙인다', () => {
    const { container } = render(
      <Prose body={[':::stack', '애플리케이션 | HTTP, DNS', '전송 | TCP, UDP', ':::'].join('\n')} />,
    )

    expect(container.querySelector('figure')).toBeTruthy()
    expect(leads(container)).toHaveLength(0)
  })

  it('빈 본문에서도 터지지 않는다', () => {
    const { container } = render(<Prose body="" />)
    expect(leads(container)).toHaveLength(0)
  })

  /**
   * 리드도 용어 링크와 인라인 마크업을 그대로 받는다.
   *
   * 리드를 따로 그리면서 문단 렌더 경로를 갈라 놓으면 첫 문단에서만 용어
   * 링크가 사라진다 — 하필 첫 등장이 몰리는 자리라 손해가 가장 크다.
   */
  it('리드 안에서도 용어 링크와 코드가 살아 있다', () => {
    const { container } = render(<Prose body={'스레드는 `GIL`을 기다린다.\n\n근거다.'} />)

    const lead = container.querySelector('.prose-lead')!
    expect(lead.querySelector('code')?.textContent).toBe('GIL')
    const link = lead.querySelector('a[href^="/concept/"]')
    expect(link?.textContent).toBe('스레드')
    expect(link?.className).toContain('focus-visible:outline-2')
  })

  it('React가 렌더를 다시 시도해도 용어 링크가 사라지지 않는다', () => {
    const { container } = render(
      <StrictMode>
        <Prose body={'프로세스와 스레드는 함께 동작한다.\n\n프로세스는 자원을 가진다.'} />
      </StrictMode>,
    )

    const links = [...container.querySelectorAll('a[href^="/concept/"]')]
    expect(links.map((link) => link.textContent)).toEqual(['프로세스', '스레드'])
  })
})
