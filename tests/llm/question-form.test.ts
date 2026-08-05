import { describe, it, expect } from 'vitest'
import {
  hasPoliteEnding,
  looksInterrogative,
  questionFormIssues,
} from '@/lib/llm/question-form'
import { EXAMPLE_NODES } from '../../data/example-nodes'

describe('hasPoliteEnding', () => {
  it('catches the shapes that actually showed up', () => {
    // 공유 트리 화면에 실제로 떠 있던 문장이다
    expect(hasPoliteEnding('커넥션 풀 크기를 왜 코어 수로 잡는지 그 이유가 궁금합니다.')).toBe(true)
    expect(hasPoliteEnding('인덱스가 왜 안 타나요?')).toBe(true)
    expect(hasPoliteEnding('어떻게 해야 하나요')).toBe(true)
    expect(hasPoliteEnding('이게 맞을까요?')).toBe(true)
    expect(hasPoliteEnding('무엇인가요?')).toBe(true)
    expect(hasPoliteEnding('그렇죠?')).toBe(true)
    expect(hasPoliteEnding('알려주세요')).toBe(true)
  })

  it('leaves the target form alone', () => {
    expect(hasPoliteEnding('TIME_WAIT이 필요한 이유는?')).toBe(false)
    expect(hasPoliteEnding('낙관적 락과 비관적 락은 무엇으로 고르는가?')).toBe(false)
    expect(hasPoliteEnding('컨텍스트 스위칭 비용은 어디서 발생하는가?')).toBe(false)
    expect(hasPoliteEnding('스레드끼리 무엇을 공유하는가')).toBe(false)
  })

  it('does not care about politeness in the middle', () => {
    // 어미만 본다. 중간까지 잡으려 들면 인용이나 고유명사에서 헛걸린다
    expect(hasPoliteEnding('"감사합니다"를 로그에 남기면 무엇이 문제인가?')).toBe(false)
  })

  it('ignores trailing punctuation and space', () => {
    expect(hasPoliteEnding('무엇인가요 ?')).toBe(true)
    expect(hasPoliteEnding('무엇인가요…')).toBe(true)
    expect(hasPoliteEnding('무엇인가?  ')).toBe(false)
  })
})

describe('looksInterrogative', () => {
  it('accepts a question mark', () => {
    expect(looksInterrogative('무엇을 먼저 보는가?')).toBe(true)
  })

  /** 물음표를 빠뜨리는 것이 어미를 틀리는 것보다 흔하다 */
  it('accepts the form even without a question mark', () => {
    expect(looksInterrogative('무엇을 먼저 보는가')).toBe(true)
    expect(looksInterrogative('어디서 발생하나')).toBe(true)
  })

  it('rejects a statement', () => {
    expect(looksInterrogative('커넥션 풀은 재사용을 위한 것이다')).toBe(false)
    expect(looksInterrogative('TIME_WAIT 설명')).toBe(false)
  })
})

describe('questionFormIssues', () => {
  it('reports every rule that was broken', () => {
    expect(questionFormIssues('무엇인가?')).toEqual([])
    expect(questionFormIssues('무엇인가요?')).toEqual(['polite'])
    expect(questionFormIssues('커넥션 풀 설명')).toEqual(['not-interrogative'])
  })
})

/**
 * 손으로 쓴 예시가 곧 목표형이다.
 *
 * 여기가 깨지면 검사기가 틀렸거나 예시가 규칙을 벗어난 것이다. 어느 쪽이든
 * 생성 프롬프트의 기준선이 흔들린 것이라 그냥 넘어갈 수 없다.
 */
describe('example nodes as the reference form', () => {
  it('every example question is in the target form', () => {
    const bad = EXAMPLE_NODES.filter((e) => questionFormIssues(e.question).length > 0).map(
      (e) => e.question,
    )
    expect(bad).toEqual([])
  })

  it('every suggested follow-up is too', () => {
    const bad = EXAMPLE_NODES.flatMap((e) => e.suggestions).filter(
      (s) => questionFormIssues(s).length > 0,
    )
    expect(bad).toEqual([])
  })
})

/**
 * 예시는 생성 프롬프트의 기준선이다.
 *
 * 프롬프트에 "꼬리질문은 35자를 넘기지 않는다"고 적어놓고 예시가 그것을 어기면
 * 모델은 규칙이 아니라 예시를 따른다. 도식도 마찬가지다 — 도식 없는 예시가
 * 섞이면 그것이 허용 신호가 된다.
 */
describe('example nodes follow their own rules', () => {
  it('keeps every follow-up short enough for a button', () => {
    const long = EXAMPLE_NODES.flatMap((e) => e.suggestions).filter((s) => s.length > 35)
    expect(long).toEqual([])
  })

  it('gives every category at least two entries', () => {
    const count = new Map<string, number>()
    for (const e of EXAMPLE_NODES) count.set(e.category, (count.get(e.category) ?? 0) + 1)
    const thin = [...count].filter(([, n]) => n < 2).map(([c]) => c)
    expect(thin).toEqual([])
  })

  it('gives every example exactly five follow-ups', () => {
    const off = EXAMPLE_NODES.filter((e) => e.suggestions.length !== 5).map((e) => e.question)
    expect(off).toEqual([])
  })
})
