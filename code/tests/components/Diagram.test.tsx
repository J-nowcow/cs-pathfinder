// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Prose } from '@/components/Prose'
import { StateDiagram } from '@/components/Diagram'

/**
 * 도식이 화면에 실제로 그려지는지.
 *
 * 파서 테스트는 구조만 본다. 구조가 맞아도 렌더에서 빠뜨리면 사용자는 아무것도
 * 못 본다. 실제로 Prose가 블록 종류를 하나만 놓쳐도 그 도식은 통째로 사라진다.
 */
afterEach(cleanup)

describe('Prose — 순서 도식', () => {
  /*
   * 오가는 것은 기둥과 화살표로 그린다.
   *
   * 전에는 `클라이언트`와 `서버`가 걸음마다 반복돼 두 번씩 나왔다. 지금은
   * 기둥 머리에 한 번씩만 서고 오간 것은 화살표가 말한다 — 핸드셰이크가
   * "1번 다음 2번"이 아니라 왕복으로 보여야 하기 때문이다.
   *
   * **화살표는 낭독기가 못 읽는다.** 그래서 누가 누구에게 무엇을 보냈는지를
   * 문장으로 따로 남기는지도 같이 건다. 이게 빠지면 그림만 남는다.
   */
  it('오가는 걸음은 기둥으로 그리고 문장으로도 남긴다', () => {
    const { container } = render(
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

    // 기둥 머리에 한 번씩
    expect(screen.getAllByText('클라이언트').length).toBe(1)
    expect(screen.getAllByText('서버').length).toBe(1)

    // 낭독기가 읽을 것
    const sr = [...container.querySelectorAll('.sr-only')].map((e) => e.textContent)
    expect(sr).toContain('1. 클라이언트에서 서버로: SYN')
    expect(sr).toContain('2. 서버에서 클라이언트로: SYN + ACK')
  })

  /*
   * 한 방향으로만 흐르는 것은 손대지 않는다. 파이프라인에 기둥을 세우면
   * 마디마다 하나씩 서서 화살표가 글자보다 짧아진다.
   */
  it('한 줄로 이어지면 마디를 한 번만 그린다', () => {
    const { container } = render(
      <Prose
        body={[
          ':::flow',
          '소스 -> 컴파일러: 기계어로 바꾼다',
          '컴파일러 -> 링커: 실행 파일을 만든다',
          ':::',
        ].join('\n')}
      />,
    )

    // 걸음마다 되풀이하지 않는다. 사슬에서 같은 이름은 같은 자리다
    expect(screen.getAllByText('컴파일러').length).toBe(1)
    expect(screen.getByText('기계어로 바꾼다')).toBeTruthy()

    // 세로 순서만으로 방향이 전해지면 안 된다
    const sr = [...container.querySelectorAll('.sr-only')].map((e) => e.textContent)
    expect(sr).toContain('그다음은 컴파일러다. ')
    expect(sr).toContain('그다음은 링커다. ')
  })

  /*
   * 낭독기가 읽는 문장이라 눈으로는 안 걸린다. 소리로 들으면 바로 걸린다 --
   * `주문다`가 아니라 `주문이다`다. 실제 해설에서 넷 중 둘이 틀려 있었다.
   */
  it('받침이 있는 마디에는 이를 붙인다', () => {
    const { container } = render(
      <Prose
        body={[':::flow', '요청 -> 주문: 넘긴다', '주문 -> 결제: 다시 넘긴다', ':::'].join('\n')}
      />,
    )
    const sr = [...container.querySelectorAll('.sr-only')].map((e) => e.textContent)
    expect(sr).toContain('그다음은 주문이다. ')
    expect(sr).toContain('그다음은 결제다. ')
  })

  /* 갈라지는 것은 사슬이 아니다. 지금 목록 그대로 둔다 */
  it('갈라지면 걸음마다 행위자를 되풀이한다', () => {
    render(
      <Prose
        body={[
          ':::flow',
          '수집기 -> 미도달 객체: 회수한다',
          '수집기 -> 생존 객체: 압축한다',
          ':::',
        ].join('\n')}
      />,
    )

    expect(screen.getAllByText('수집기').length).toBe(2)
  })

  /**
   * 번호가 없으면 순서인지 목록인지 구별이 안 된다.
   *
   * 사슬은 걸음이 아니라 **마디**를 센다. `A→B→C→D`는 걸음 셋이지만 마디는
   * 넷이고, 사람이 세는 것은 거쳐 가는 자리다.
   */
  it('사슬은 마디마다 번호를 붙인다', () => {
    const { container } = render(
      <Prose body={[':::flow', 'A -> B: 하나', 'B -> C: 둘', 'C -> D: 셋', ':::'].join('\n')} />,
    )

    const items = container.querySelectorAll('ol > li')
    expect(items.length).toBe(4)
    expect(items[0].textContent).toContain('1')
    expect(items[0].textContent).toContain('A')
    expect(items[3].textContent).toContain('4')
    expect(items[3].textContent).toContain('D')
    expect(container.textContent).toContain('셋')
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

  /**
   * 좁은 화면에서 표는 줄 단위 카드로 접힌다(globals.css). 접히면 머리글 줄이
   * 사라지므로 각 칸이 자기 머리글을 이름표로 들고 있어야 한다. 이게 빠지면
   * 폰에서 "다양한 조인 순서 선택"이 무슨 칸의 값인지 알 수 없다.
   */
  it('carries its column name on every cell for the folded layout', () => {
    const { container } = render(
      <Prose
        body={['| 기준 | 낙관적 | 비관적 |', '| --- | --- | --- |', '| 충돌 | 드물다 | 잦다 |'].join(
          '\n',
        )}
      />,
    )

    const cells = [...container.querySelectorAll('tbody td')]
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual(['기준', '낙관적', '비관적'])
  })

  /**
   * display를 바꿔 접으면 브라우저가 표 의미를 잃는다. role을 손으로 붙여야
   * 카드로 접힌 뒤에도 스크린 리더가 표로 읽는다.
   */
  it('keeps table semantics explicit so folding cannot strip them', () => {
    const { container } = render(
      <Prose body={['| 기준 | 값 |', '| --- | --- |', '| 하나 | 둘 |'].join('\n')} />,
    )

    expect(container.querySelector('table')?.getAttribute('role')).toBe('table')
    expect(container.querySelector('tbody tr')?.getAttribute('role')).toBe('row')
    expect(container.querySelector('tbody td')?.getAttribute('role')).toBe('cell')
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

/**
 * 상태 전이 도식.
 *
 * flow와 다른 전부가 **출발 상태로 묶는 것**이다. 한 상태에서 여러 갈래로
 * 나가는 것이 상태 머신의 요점인데, flow처럼 번호를 매기면 그 갈림이
 * "그다음 차례"로 읽힌다.
 */
describe('StateDiagram', () => {
  const steps = [
    { from: '닫힘', to: '열림', label: '실패율이 기준을 넘는다' },
    { from: '열림', to: '반열림', label: '일정 시간이 지난다' },
    { from: '반열림', to: '닫힘', label: '성공하면 원래대로' },
    { from: '반열림', to: '열림', label: '실패하면 다시 막는다' },
  ]

  it('출발 상태별로 묶는다', () => {
    const { container } = render(<StateDiagram steps={steps} />)
    // 전이는 넷인데 출발 상태는 셋이다
    expect(container.querySelectorAll('figure > ul > li')).toHaveLength(3)
  })

  /*
   * 낭독기가 중첩 목록을 그대로 읽으므로 "반열림 아래에 두 갈래"가 소리로도
   * 전달된다. 이것이 flow로 그릴 때 잃는 정보다.
   */
  it('갈라지는 상태 아래에 두 갈래를 둔다', () => {
    const { container } = render(<StateDiagram steps={steps} />)
    const outer = [...container.querySelectorAll('figure > ul > li')]
    const branching = outer.find((li) => li.textContent?.startsWith('반열림'))!
    expect(branching.querySelectorAll('ul > li')).toHaveLength(2)
  })

  /*
   * 그림만 보고 알 수 없으면 안 된다. 낭독기용 글자를 따로 둔다.
   *
   * 서킷 브레이커는 `반열림`에서 나가는 둘(`닫힘`·`열림`)이 **모두** 앞에
   * 나온 상태로 돌아간다. 상태 머신이 도는 구조라 되돌아가는 길이 흔하다.
   */
  it('되돌아가는 전이를 낭독기에도 알린다', () => {
    render(<StateDiagram steps={steps} />)
    expect(screen.getAllByText('(앞의 상태로 돌아간다)')).toHaveLength(2)
  })

  it('앞으로만 가는 전이에는 안 붙인다', () => {
    render(<StateDiagram steps={steps.slice(0, 2)} />)
    expect(screen.queryByText('(앞의 상태로 돌아간다)')).toBeNull()
  })

  it('설명이 없어도 그린다', () => {
    const { container } = render(
      <StateDiagram steps={[{ from: 'A', to: 'B', label: '' }, { from: 'B', to: 'C', label: '' }]} />,
    )
    expect(container.querySelectorAll('figure > ul > li')).toHaveLength(2)
  })
})
