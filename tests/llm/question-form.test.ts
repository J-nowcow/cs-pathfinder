import { describe, it, expect } from 'vitest'
import {
  hasPoliteEnding,
  looksInterrogative,
  questionFormIssues,
} from '@/lib/llm/question-form'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { parseBlocks } from '@/lib/markdown/blocks'
import { GENERATED_NODES } from '../../data/generated-nodes'

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
 * 예시는 사용자가 실제로 읽는 콘텐츠다.
 *
 * 프롬프트에는 안 들어간다(시드 전용). 그래서 여기가 깨져도 모델 출력이
 * 나빠지지는 않는다. 대신 사이트가 두 사람이 쓴 것처럼 읽힌다 — 생성분은
 * 꼬리질문이 짧고 도식이 답 바로 뒤에 오는데 손으로 쓴 것만 다르면
 * 그 차이가 그대로 보인다.
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

  /**
   * 생성 쪽 규칙과 같은 선이다. 폰에서 한 줄이 24자쯤이라 150자면 여섯 줄이고,
   * 그보다 길면 읽다가 눈이 미끄러진다. 손으로 쓴 것이라고 예외를 두면
   * 예시만 벽이 된다.
   */
  it('keeps every paragraph short enough to read on a phone', () => {
    const long = EXAMPLE_NODES.flatMap((e) =>
      parseBlocks(e.body)
        .filter((b) => b.type === 'paragraph')
        .map((b) => (b as { text: string }).text)
        .filter((t) => t.length > 150),
    )
    expect(long).toEqual([])
  })

  /**
   * 도식은 답 바로 뒤에 와야 한다. 줄글을 세 문단 쌓은 뒤에 놓으면 거기까지
   * 가기 전에 읽기를 그만둔다. 생성분이 지키는 것을 예시가 안 지킬 이유가 없다.
   */
  it('puts the diagram right after the answer, not behind a wall of text', () => {
    const late = EXAMPLE_NODES.filter((e) => {
      const at = parseBlocks(e.body).findIndex((b) => b.type !== 'paragraph')
      return at >= 3
    }).map((e) => e.question)
    expect(late).toEqual([])
  })

  it('gives every example exactly five follow-ups', () => {
    const off = EXAMPLE_NODES.filter((e) => e.suggestions.length !== 5).map((e) => e.question)
    expect(off).toEqual([])
  })
})

/**
 * 생성된 노드도 화면에 나간다.
 *
 * 손으로 쓴 예시와 파일은 나눠 두지만(그쪽이 기준선이라) 사용자는 둘을
 * 나란히 읽는다. 한쪽만 문단이 길거나 도식이 뒤에 있으면 그 차이가 보인다.
 *
 * 이 시험이 깨지면 build-generated-nodes.ts의 거르는 조건이 느슨해진 것이다.
 */
describe('generated nodes meet the same bar', () => {
  it('every question is in the target form and short enough', () => {
    const bad = GENERATED_NODES.filter(
      (e) => questionFormIssues(e.question).length > 0 || e.question.length > 40,
    ).map((e) => e.question)
    expect(bad).toEqual([])
  })

  it('every follow-up fits a button', () => {
    const bad = GENERATED_NODES.flatMap((e) => e.suggestions).filter(
      (s) => s.length > 35 || questionFormIssues(s).length > 0,
    )
    expect(bad).toEqual([])
  })

  it('puts a diagram right after the answer', () => {
    const bad = GENERATED_NODES.filter((e) => {
      const at = parseBlocks(e.body).findIndex((b) => b.type !== 'paragraph')
      return at < 0 || at >= 3
    }).map((e) => e.question)
    expect(bad).toEqual([])
  })

  it('keeps every paragraph readable on a phone', () => {
    const long = GENERATED_NODES.flatMap((e) =>
      parseBlocks(e.body)
        .filter((b) => b.type === 'paragraph')
        .map((b) => (b as { text: string }).text)
        .filter((t) => t.length > 150),
    )
    expect(long).toEqual([])
  })

  /** 같은 질문이 양쪽에 있으면 노드 id가 겹쳐 하나가 다른 하나를 덮는다 */
  it('does not collide with a hand-written example', () => {
    const hand = new Set(EXAMPLE_NODES.map((e) => `${e.identityScope}::${e.question}`))
    const clash = GENERATED_NODES.filter((g) => hand.has(`${g.identityScope}::${g.question}`)).map(
      (g) => g.question,
    )
    expect(clash).toEqual([])
  })
})
