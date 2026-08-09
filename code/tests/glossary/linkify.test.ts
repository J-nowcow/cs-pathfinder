import { describe, it, expect } from 'vitest'
import { linkifyTokens, type LinkedToken } from '@/lib/glossary/linkify'
import { parseInline } from '@/lib/markdown/inline'

/**
 * 용어 링크의 함정 넷이 각각 막혀 있는가.
 *
 * ① 도배(첫 등장만) ② 도식 오염(문단 토큰만 — 구조로 막혀 시험 불가)
 * ③ 부분 문자열 ④ 조사. 여기 시험이 깨지면 본문 전체의 링크가 무너진다 —
 * 이 함수는 모든 해설 문단을 지난다.
 */
const kinds = (out: LinkedToken[]) => out.map((t) => t.type)
const termsOf = (out: LinkedToken[]) =>
  out.filter((t): t is Extract<LinkedToken, { type: 'term' }> => t.type === 'term').map((t) => t.term)

const run = (text: string, seen = new Set<string>()) => linkifyTokens(parseInline(text), seen)

describe('용어 링크', () => {
  it('용어를 링크 토큰으로 바꾼다', () => {
    const out = run('스레드는 메모리를 공유한다')
    expect(termsOf(out)).toEqual(['스레드'])
    /* 조사는 링크 밖 텍스트로 남는다 */
    expect(out.find((t) => t.type === 'text' && t.value.startsWith('는'))).toBeTruthy()
  })

  /** ① 도배 — 같은 용어 두 번째부터는 잇지 않는다 */
  it('첫 등장만 잇는다', () => {
    const out = run('스레드가 있다. 스레드는 흐름이다')
    expect(termsOf(out)).toEqual(['스레드'])
  })

  /** ①의 본문 단위 판정 — seen을 문단 사이에 공유한다 */
  it('앞 문단에서 이었으면 다음 문단은 잇지 않는다', () => {
    const seen = new Set<string>()
    expect(termsOf(run('스레드가 있다', seen))).toEqual(['스레드'])
    expect(termsOf(run('스레드는 흐름이다', seen))).toEqual([])
  })

  /** ③ 부분 문자열 — 영문 */
  it('GCC 속 GC를 잡지 않는다', () => {
    expect(termsOf(run('GCC로 컴파일한다'))).toEqual([])
  })

  /** ③ 부분 문자열 — 한글 합성어 */
  it('스택오버플로 속 스택을 잡지 않는다', () => {
    expect(termsOf(run('스택오버플로가 난다'))).toEqual([])
  })

  /**
   * ③의 회복 — 첫 등장이 합성어라 못 이었으면 다음 홑 등장을 잇는다.
   * 합성어가 seen을 태우면 진짜 등장이 영영 안 이어진다.
   */
  it('합성어에 막힌 용어는 다음 홑 등장에서 잇는다', () => {
    const out = run('스택오버플로는 스택이 넘친 것이다')
    expect(termsOf(out)).toEqual(['스택'])
  })

  /** ④ 조사 목록 밖의 한글 이어짐은 합성어다 */
  it('열거한 조사만 허용한다', () => {
    expect(termsOf(run('힙에 놓인다'))).toEqual(['힙'])
    /* '영역'은 조사가 아니다 — 힙영역은 합성어로 본다 */
    expect(termsOf(run('힙영역에 놓인다'))).toEqual([])
  })

  /** 긴 용어 우선 — 겹칠 때 짧은 쪽이 먼저 먹으면 안 된다 */
  it('컨텍스트 스위칭을 통째로 잇는다', () => {
    const out = run('컨텍스트 스위칭 비용이 크다')
    expect(termsOf(out)).toEqual(['컨텍스트 스위칭'])
  })

  /** 코드·굵게 토큰은 건드리지 않는다 */
  it('code와 bold 토큰은 그대로 둔다', () => {
    const out = run('`스레드`와 **스택**과 힙')
    expect(kinds(out)).toContain('code')
    expect(kinds(out)).toContain('bold')
    expect(termsOf(out)).toEqual(['힙'])
  })

  it('영문 용어에 조사가 붙어도 잡는다', () => {
    expect(termsOf(run('TCP는 연결을 맺는다'))).toEqual(['TCP'])
  })
})
