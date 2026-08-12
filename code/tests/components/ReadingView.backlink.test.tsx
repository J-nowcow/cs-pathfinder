// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { ReadingView } from '@/components/ReadingView'

/**
 * 나가는 링크의 글자와 가는 곳이 같은가.
 *
 * **달랐다.** `← 질문 목록`이라고 쓰고 `/`로 보냈다. 같은 화면 헤더의
 * `질문 목록`은 `/questions`로 가므로 **글자가 같은 링크 둘이 서로 다른 데로
 * 갔다.** 대문에도 "목록으로 돌아가요"라고 적혀 있다.
 *
 * 눈으로는 안 잡힌다 — 눌러 보면 홈도 그럴듯한 화면이라 잘못 갔다는 느낌이
 * 안 든다. 주소를 읽어야 보인다.
 */
const NODE = {
  id: 'n1',
  number: 1,
  question: '질문 하나는?',
  body: '본문이다.',
  identityScope: 'generic',
  category: '네트워크',
  tags: [],
  level: null,
  suggestions: [],
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('질문 화면의 돌아가기 링크', () => {
  it('글자대로 질문 목록으로 간다', () => {
    render(<ReadingView initialNode={NODE} initialQuota={{ used: 0, limit: 5 }} />)
    expect(screen.getByText('← 질문 목록').getAttribute('href')).toBe('/questions')
  })

  /*
   * 판정 영역을 20px에서 44px로 키운 것을 지킨다. `py`만 남고 `-my`가 빠지면
   * 줄 높이가 24px 늘어 위아래 간격이 어긋난다. 반대로 `-my`만 남으면 자리가
   * 겹친다. 둘은 같이 있어야 한다.
   */
  it('누르는 자리를 키운 클래스가 짝으로 남아 있다', () => {
    render(<ReadingView initialNode={NODE} initialQuota={{ used: 0, limit: 5 }} />)
    const cls = screen.getByText('← 질문 목록').className
    expect(cls).toContain('py-[12px]')
    expect(cls).toContain('-my-[12px]')
  })
})

describe('질문 화면의 분류 정보', () => {
  it('내부 의미 범위는 숨기고 사용자용 분야만 보여준다', () => {
    render(<ReadingView initialNode={NODE} initialQuota={{ used: 0, limit: 5 }} />)
    expect(screen.getByText('네트워크')).toBeTruthy()
    expect(screen.queryByText('generic')).toBeNull()
  })
})
