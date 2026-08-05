// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Prose } from '@/components/Prose'

/**
 * 도식이 화면에 실제로 그려지는지.
 *
 * 파서 테스트는 구조만 본다. 구조가 맞아도 렌더에서 빠뜨리면 사용자는 아무것도
 * 못 본다. 실제로 Prose가 블록 종류를 하나만 놓쳐도 그 도식은 통째로 사라진다.
 */
afterEach(cleanup)

describe('Prose — 순서 도식', () => {
  it('draws each step with its actors and label', () => {
    render(
      <Prose
        body={[
          '앞 문단이다.',
          '',
          ':::flow',
          '클라이언트 -> 서버: SYN',
          '서버 -> 클라이언트: SYN + ACK',
          ':::',
        ].join('\n')}
      />,
    )

    expect(screen.getByText('앞 문단이다.')).toBeTruthy()
    expect(screen.getByText('SYN')).toBeTruthy()
    expect(screen.getByText('SYN + ACK')).toBeTruthy()
    // 행위자는 단계마다 반복되므로 여러 개가 나온다
    expect(screen.getAllByText('클라이언트').length).toBe(2)
    expect(screen.getAllByText('서버').length).toBe(2)
  })

  /** 번호가 없으면 순서인지 목록인지 구별이 안 된다 */
  it('numbers the steps in order', () => {
    const { container } = render(
      <Prose body={[':::flow', 'A -> B: 하나', 'B -> C: 둘', 'C -> D: 셋', ':::'].join('\n')} />,
    )

    const items = container.querySelectorAll('ol > li')
    expect(items.length).toBe(3)
    expect(items[0].textContent).toContain('1')
    expect(items[2].textContent).toContain('셋')
  })

  /** 순서는 ol이어야 스크린 리더가 "3개 중 1번"으로 읽는다 */
  it('uses an ordered list', () => {
    const { container } = render(<Prose body={[':::flow', 'A -> B: 하나', ':::'].join('\n')} />)
    expect(container.querySelector('ol')).toBeTruthy()
  })

  it('renders bold and code inside a label', () => {
    const { container } = render(
      <Prose body={[':::flow', 'A -> B: **꼭** `SO_REUSEADDR` 확인', ':::'].join('\n')} />,
    )
    expect(container.querySelector('strong')?.textContent).toBe('꼭')
    expect(container.querySelector('code')?.textContent).toBe('SO_REUSEADDR')
  })
})

describe('Prose — 계층 도식', () => {
  it('draws layers top to bottom with notes', () => {
    const { container } = render(
      <Prose
        body={[':::stack', '애플리케이션 | HTTP, DNS', '전송 | TCP, UDP', '네트워크', ':::'].join(
          '\n',
        )}
      />,
    )

    const items = container.querySelectorAll('ul > li')
    expect(items.length).toBe(3)
    // 위가 위층이다. 순서가 뒤집히면 계층 도식의 의미가 없다
    expect(items[0].textContent).toContain('애플리케이션')
    expect(items[2].textContent).toContain('네트워크')
    expect(screen.getByText('HTTP, DNS')).toBeTruthy()
  })

  it('omits the note when there is none', () => {
    const { container } = render(<Prose body={[':::stack', '혼자', ':::'].join('\n')} />)
    const item = container.querySelector('ul > li')
    expect(item?.textContent?.trim()).toBe('혼자')
  })
})

describe('Prose — 비교표', () => {
  it('draws a header row and body rows', () => {
    const { container } = render(
      <Prose
        body={[
          '| 기준 | 낙관적 | 비관적 |',
          '| --- | --- | --- |',
          '| 충돌 | 드물다 | 잦다 |',
          '| 잠금 | 커밋 때 | 즉시 |',
        ].join('\n')}
      />,
    )

    expect(container.querySelectorAll('thead th').length).toBe(3)
    expect(container.querySelectorAll('tbody tr').length).toBe(2)
    expect(screen.getByText('드물다')).toBeTruthy()
  })

  /** scope가 없으면 스크린 리더가 어느 열의 값인지 못 읽는다 */
  it('marks header cells with a scope', () => {
    const { container } = render(
      <Prose body={['| 기준 | 값 |', '| --- | --- |', '| 하나 | 둘 |'].join('\n')} />,
    )
    for (const th of container.querySelectorAll('thead th')) {
      expect(th.getAttribute('scope')).toBe('col')
    }
  })
})

describe('Prose — 도식이 없을 때', () => {
  it('renders plain paragraphs unchanged', () => {
    const { container } = render(<Prose body={'첫째 문단.\n\n둘째 문단.'} />)
    expect(container.querySelectorAll('p').length).toBe(2)
    expect(container.querySelector('figure')).toBeNull()
  })

  /**
   * 못 알아본 울타리가 화면에 보이면 고장으로 읽힌다. 파서가 털어내는데
   * 렌더까지 와서 확인한다 — 두 겹으로 막아야 하는 실패다.
   */
  it('never shows a fence marker', () => {
    const { container } = render(
      <Prose body={'앞 문단.\n\n:::flowchart\n이상한 것\n:::\n\n뒤 문단.'} />,
    )
    expect(container.textContent).not.toContain(':::')
  })

  it('renders an empty body without crashing', () => {
    const { container } = render(<Prose body="" />)
    expect(container.textContent).toBe('')
  })
})
