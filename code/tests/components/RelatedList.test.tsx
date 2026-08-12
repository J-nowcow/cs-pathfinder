// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RelatedList } from '@/components/RelatedList'
import type { PublicRelated } from '@/lib/api/expand-client'

/**
 * 관련 질문.
 *
 * 두 가지가 걸려 있다.
 *
 * 하나는 **본 것 표시의 시점**이다. 무엇을 봤는지는 localStorage에 있고
 * 서버 렌더에는 없다. 복원 전에 그리면 "안 본 질문"으로 한 번 그렸다가
 * 바뀌고, 서버가 만든 HTML과도 어긋난다(hydration mismatch). 그래서
 * 복원이 끝났다는 신호를 받은 뒤에만 뱃지를 단다.
 *
 * 다른 하나는 **빈 목록의 처리**다. 관계도 벡터도 없는 노드가 있다. 제목만
 * 남은 섹션은 고장으로 읽힌다.
 */
afterEach(cleanup)

const ITEMS: PublicRelated[] = [
  { id: 'n1', number: 12, question: 'STW는 왜 필요한가?', category: '운영체제', reason: null },
  {
    id: 'n2',
    number: 34,
    question: 'GC 멈춤은 왜 생기는가?',
    category: '언어',
    reason: '같은 밑바탕을 다룬다',
  },
]

describe('관련 질문 목록', () => {
  it('추천 꼬리질문과 구분되는 이름을 쓴다', () => {
    render(<RelatedList items={ITEMS} readIds={new Set()} hydrated />)
    expect(screen.getByRole('heading', { name: '관련 질문' })).toBeTruthy()
    expect(screen.queryByText('이거 봤으면 이것도')).toBeNull()
  })

  it('질문과 분류를 그리고 번호로 링크한다', () => {
    render(<RelatedList items={ITEMS} readIds={new Set()} hydrated />)

    const first = screen.getByRole('link', { name: /STW는 왜 필요한가\?/ })
    expect(first.getAttribute('href')).toBe('/q/12')
    expect(screen.getByText('운영체제')).toBeTruthy()
  })

  it('왜 이어졌는지가 있으면 함께 보여준다', () => {
    render(<RelatedList items={ITEMS} readIds={new Set()} hydrated />)
    expect(screen.getByText('같은 밑바탕을 다룬다')).toBeTruthy()
  })

  /** 근거 없이 이어진 것(벡터)에 빈 줄을 남기지 않는다 */
  it('이유가 없으면 그 자리를 비운다', () => {
    render(<RelatedList items={[ITEMS[0]]} readIds={new Set()} hydrated />)
    expect(screen.queryByText('같은 밑바탕을 다룬다')).toBeNull()
  })

  it('이미 본 질문에는 표시를 단다', () => {
    render(<RelatedList items={ITEMS} readIds={new Set(['n2'])} hydrated />)
    expect(screen.getAllByText('본 질문')).toHaveLength(1)
  })

  /**
   * 복원 전에는 여정이 1개짜리 새것이라 **거의 다 "안 본 질문"으로 나온다.**
   * 그 상태로 그리면 사실과 다른 화면을 한 틱 보여주고, 서버 HTML과도 어긋난다.
   */
  it('복원 전에는 본 표시를 달지 않는다', () => {
    render(<RelatedList items={ITEMS} readIds={new Set(['n2'])} hydrated={false} />)
    expect(screen.queryByText('본 질문')).toBeNull()
    /* 목록 자체는 그린다. 표시만 미룬다 */
    expect(screen.getByText('GC 멈춤은 왜 생기는가?')).toBeTruthy()
  })

  it('줄 것이 없으면 제목까지 통째로 없다', () => {
    const { container } = render(<RelatedList items={[]} readIds={new Set()} hydrated />)
    expect(container.innerHTML).toBe('')
  })
})
