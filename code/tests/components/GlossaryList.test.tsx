// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GlossaryList } from '@/components/GlossaryList'
import { GLOSSARY } from '../../data/glossary'

/**
 * 사전 목록 화면.
 *
 * 여기서 제일 비싼 실수는 **앵커가 바뀌는 것**이다. 본문의 용어 링크가
 * 전부 `#용어`로 오는데, 목록 마크업을 손보다 id 모양을 바꾸면 해설
 * 335편의 링크가 한꺼번에 죽는다. 화면에서는 아무 표시도 안 난다.
 */
afterEach(cleanup)

const anchors = (c: HTMLElement) => [...c.querySelectorAll('dl > div[id]')].map((el) => el.id)

describe('용어 사전 목록', () => {
  it('처음에는 전부 보인다', () => {
    const { container } = render(<GlossaryList />)
    expect(anchors(container)).toHaveLength(GLOSSARY.length)
  })

  /**
   * 본문 링크의 과녁. Prose가 `#${encodeURIComponent(term)}`로 보내고
   * 브라우저가 풀어서 이 id와 맞춘다. 글자 그대로여야 한다.
   */
  it('용어 앵커가 용어 이름 그대로다', () => {
    const { container } = render(<GlossaryList />)
    const ids = new Set(anchors(container))
    for (const g of GLOSSARY) expect(ids.has(g.term)).toBe(true)
  })

  /* 띄어쓰기가 든 용어가 11개다. 여기서 모양이 바뀌면 그것들만 조용히 죽는다 */
  it('띄어쓰기가 든 용어도 앵커를 그대로 쓴다', () => {
    const { container } = render(<GlossaryList />)
    expect(container.querySelector('[id="컨텍스트 스위칭"]')).toBeTruthy()
    expect(container.querySelector('[id="시간 복잡도"]')).toBeTruthy()
  })

  it('가나다순으로 늘어놓고 영문을 뒤에 둔다', () => {
    const { container } = render(<GlossaryList />)
    const ids = anchors(container)
    expect(ids[0]).toBe('가용성')
    /* 영문 구간이 끝자락이다 */
    expect(ids.at(-1)).toBe('XSS')
    expect(ids.indexOf('힙')).toBeLessThan(ids.indexOf('ACK'))
  })
})

describe('용어 사전 검색', () => {
  const type = async (text: string) => {
    await userEvent.type(screen.getByRole('searchbox', { name: '용어 검색' }), text)
  }

  /* 병기는 표시일 뿐 — 앵커·정렬은 term 그대로여야 한다 (위 앵커 시험이 지킨다) */
  it('영문 표기를 병기하고, 영문으로 검색해도 닿는다', async () => {
    const { container } = render(<GlossaryList />)
    const dt = container.querySelector('div[id="스레드"] dt')
    expect(dt?.textContent).toContain('스레드')
    expect(dt?.textContent).toContain('Thread')

    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox'), 'thread')
    expect(anchors(container)).toContain('스레드')
    expect(anchors(container)).not.toContain('GC')
  })

  it('용어 이름으로 거른다', async () => {
    const { container } = render(<GlossaryList />)
    await type('스레드')
    const ids = anchors(container)
    expect(ids).toContain('스레드')
    expect(ids).toContain('메인 스레드')
    expect(ids).not.toContain('힙')
  })

  /* 이름을 모르니까 찾는다. 뜻으로 닿지 않으면 사전이 아니다 */
  it('뜻으로도 거른다', async () => {
    const { container } = render(<GlossaryList />)
    await type('회수')
    expect(anchors(container)).toContain('GC')
  })

  it('대소문자를 가리지 않는다', async () => {
    const { container } = render(<GlossaryList />)
    await type('tcp')
    expect(anchors(container)).toContain('TCP')
  })

  /* 글자를 쳐도 아무 일이 없는 것처럼 보이면 안 된다 — 낭독기에도 알린다 */
  it('찾은 개수를 말한다', async () => {
    render(<GlossaryList />)
    await type('스레드')
    expect(screen.getByRole('status').textContent).toMatch(/개 찾았습니다/)
  })

  it('없으면 없다고 말한다', async () => {
    const { container } = render(<GlossaryList />)
    await type('없는말입니다')
    expect(anchors(container)).toHaveLength(0)
    expect(screen.getByRole('status').textContent).toMatch(/찾는 용어가 없습니다/)
  })

  /* 안 쳤을 때까지 개수를 떠들면 시끄럽다 */
  it('검색 전에는 개수를 말하지 않는다', () => {
    render(<GlossaryList />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('검색어를 한 번에 지우고 전체 목록으로 돌아간다', async () => {
    const { container } = render(<GlossaryList />)
    await type('스레드')
    await userEvent.click(screen.getByRole('button', { name: '용어 검색 지우기' }))
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('')
    expect(anchors(container)).toHaveLength(GLOSSARY.length)
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('용어 사전 초성 인덱스', () => {
  const bar = () => screen.getByRole('navigation', { name: '초성으로 건너뛰기' })

  it('있는 초성만 세운다', () => {
    render(<GlossaryList />)
    const labels = [...bar().querySelectorAll('a')].map((a) => a.textContent)
    expect(labels).toContain('ㅅ')
    expect(labels).toContain('A')
    /* 목록에 ㄲ으로 시작하는 용어가 없다 — 된소리 칸은 애초에 안 생긴다 */
    expect(labels).not.toContain('ㄲ')
  })

  it('구간 머리글로 가는 앵커를 건다', () => {
    const { container } = render(<GlossaryList />)
    const first = bar().querySelector('a')!
    const target = decodeURIComponent(first.getAttribute('href')!.slice(1))
    expect(container.querySelector(`[id="${target}"]`)).toBeTruthy()
  })

  /* 걸러진 뒤 남지 않은 초성 칸을 누르면 아무 데도 안 간다 */
  it('검색으로 줄면 칸도 같이 준다', async () => {
    render(<GlossaryList />)
    await userEvent.type(screen.getByRole('searchbox', { name: '용어 검색' }), '스레드')
    const labels = [...bar().querySelectorAll('a')].map((a) => a.textContent)
    expect(labels).toEqual(['ㅁ', 'ㅅ'])
  })

  /* 칸이 하나뿐이면 건너뛸 데가 없다 */
  it('결과가 한 칸뿐이면 바를 감춘다', async () => {
    render(<GlossaryList />)
    await userEvent.type(screen.getByRole('searchbox', { name: '용어 검색' }), '롤백')
    expect(screen.queryByRole('navigation', { name: '초성으로 건너뛰기' })).toBeNull()
  })

  /* 폰에서 손끝이 닿아야 한다 — 헤더·카드와 같은 규칙 */
  it('누르는 자리가 44px다', () => {
    render(<GlossaryList />)
    expect(bar().querySelector('a')!.className).toContain('min-h-11')
  })
})
