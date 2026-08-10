// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Prose } from '@/components/Prose'

/**
 * 하이라이트와 콜아웃.
 *
 * 셋 다 **답 블록과 같은 시각 문법**을 쓴다 — 왼쪽 3px + soft 바탕. 강조 수단이
 * 늘어도 읽는 쪽이 새로 배울 규칙은 없다.
 *
 * dangerouslySetInnerHTML은 여기서도 안 쓴다. `<mark>`도 콜아웃도 전부 React
 * 요소로 만든다. 자유 입력이 전역 자산이 되므로 HTML 경로를 아예 두지 않는
 * 편이 정화보다 확실하다.
 */
afterEach(cleanup)

describe('Prose — 하이라이트', () => {
  it('==...==를 mark로 그린다', () => {
    const { container } = render(<Prose body={'답은 ==여기에 있다==.\n\n근거다.'} />)

    const marks = [...container.querySelectorAll('mark')]
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('여기에 있다')
  })

  /* 닫히지 않은 마커가 화면에 마크업으로 새면 안 된다 */
  it('닫히지 않은 마커는 글자 그대로 보여준다', () => {
    const { container } = render(<Prose body="==닫히지 않음" />)

    expect(container.querySelector('mark')).toBeNull()
    expect(container.textContent).toContain('==닫히지 않음')
  })

  it('콜아웃 안에서도 하이라이트가 산다', () => {
    const { container } = render(
      <Prose body={'답이다.\n\n:::note\n==핵심==이다.\n:::'} />,
    )

    const mark = container.querySelector('.callout mark')
    expect(mark?.textContent).toBe('핵심')
  })

  /* 태그처럼 생긴 글자는 글자다. 요소가 되어서는 안 된다 */
  it('마크 안의 태그 모양 글자를 주입하지 않는다', () => {
    const { container } = render(<Prose body={'==<b>굵게</b>==다.'} />)

    expect(container.querySelector('mark b')).toBeNull()
    expect(container.querySelector('mark')?.textContent).toBe('<b>굵게</b>')
  })
})

describe('Prose — 콜아웃', () => {
  it('note에 핵심 정리 라벨을 단다', () => {
    const { container } = render(<Prose body={'답이다.\n\n:::note\n요약이다.\n:::'} />)

    const box = container.querySelector('.callout')!
    expect(box.className).toContain('callout-note')
    expect(box.querySelector('.cl-label')?.textContent).toBe('핵심 정리')
    expect(box.textContent).toContain('요약이다.')
  })

  it('warn에 주의 라벨을 단다', () => {
    const { container } = render(<Prose body={'답이다.\n\n:::warn\n함정이다.\n:::'} />)

    const box = container.querySelector('.callout')!
    expect(box.className).toContain('callout-warn')
    expect(box.querySelector('.cl-label')?.textContent).toBe('주의')
  })

  it('여러 문단을 각각 그린다', () => {
    const { container } = render(
      <Prose body={'답이다.\n\n:::note\n첫 문단이다.\n\n둘째 문단이다.\n:::'} />,
    )

    const paragraphs = [...container.querySelectorAll('.callout p')]
    // 라벨 하나 + 내용 둘
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[1].textContent).toBe('첫 문단이다.')
    expect(paragraphs[2].textContent).toBe('둘째 문단이다.')
  })

  /*
   * 콜아웃 안도 줄글이다. 여기서 용어 링크를 끊으면 **본문 단위 첫 등장**이
   * 콜아웃에 걸린 용어에서만 조용히 사라진다.
   */
  it('콜아웃 안에서도 코드와 용어 링크가 산다', () => {
    const { container } = render(
      <Prose body={'답이다.\n\n:::note\n스레드는 `GIL`을 기다린다.\n:::'} />,
    )

    const box = container.querySelector('.callout')!
    expect(box.querySelector('code')?.textContent).toBe('GIL')
    expect(box.querySelector('a[href^="/glossary#"]')?.textContent).toBe('스레드')
  })

  /* 용어의 첫 등장은 본문 단위다. 콜아웃이 그 셈을 따로 돌리면 링크가 두 번 생긴다 */
  it('용어 첫 등장을 본문 단위로 센다', () => {
    const { container } = render(
      <Prose body={'스레드가 답이다.\n\n:::note\n스레드를 다시 말한다.\n:::'} />,
    )

    expect(container.querySelectorAll('a[href^="/glossary#"]')).toHaveLength(1)
  })

  /**
   * 콜아웃은 답 블록이 아니다.
   *
   * 리드는 처음 나오는 **문단**에 붙는다. 콜아웃이 먼저 와도 그 안의 문단을
   * 답으로 잡으면 답이 아닌 것이 답 자리를 차지한다.
   */
  it('콜아웃 안의 문단은 답 블록이 아니다', () => {
    const { container } = render(
      <Prose body={':::note\n요약이다.\n:::\n\n진짜 답이다.\n\n근거다.'} />,
    )

    const leads = [...container.querySelectorAll('.prose-lead')]
    expect(leads).toHaveLength(1)
    expect(leads[0].textContent).toBe('진짜 답이다.')
    expect(container.querySelector('.callout .prose-lead')).toBeNull()
  })

  it('본문에 콜아웃이 없으면 아무것도 안 그린다', () => {
    const { container } = render(<Prose body={'답이다.\n\n근거다.'} />)
    expect(container.querySelector('.callout')).toBeNull()
  })

  /* 파서가 못 알아본 자리에서도 기호가 화면에 보이면 안 된다 */
  it('깨진 울타리에서 기호가 새지 않는다', () => {
    const { container } = render(<Prose body={'답이다.\n\n:::note\n닫히지 않았다.'} />)

    expect(container.textContent).not.toContain(':::')
    expect(container.textContent).toContain('닫히지 않았다.')
  })
})
