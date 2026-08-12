import { describe, it, expect } from 'vitest'
import { proseIssues } from '@/lib/llm/prose'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { parseBlocks } from '@/lib/markdown/blocks'

/**
 * 문체 검사기.
 *
 * 프롬프트가 이미 금지하던 것들인데 생성된 219개 중 18%가 `~를 통해`,
 * 19%가 `~할 수 있다`를 쓰고 있었다. 손으로 쓴 30개는 0%와 3%였다.
 * 검사하지 않는 규칙은 규칙이 아니라 바람이었다.
 */
describe('proseIssues', () => {
  it('catches the translated-English turn', () => {
    expect(proseIssues('인덱스를 통해 조회 속도를 높인다.')).toContain('번역투(~를 통해)')
  })

  it('catches a paragraph that opens with a connective', () => {
    expect(proseIssues('따라서 인덱스를 만든다.')).toContain('접속부사로 시작')
  })

  it('catches hype words', () => {
    expect(proseIssues('이 방식은 매우 빠르다.')).toContain('과장')
  })

  it('도식 자체를 주어로 설명하는 메타 문장을 잡는다', () => {
    expect(proseIssues('위 표는 두 락의 차이를 보여준다.')).toContain('도식을 지칭하며 설명')
    expect(proseIssues('이 흐름에서 요청은 서버로 간다.')).toContain('도식을 지칭하며 설명')
    expect(proseIssues('요청은 인증을 거쳐 서버로 간다.')).not.toContain('도식을 지칭하며 설명')
  })

  it('해설에 섞인 경어체 종결을 잡는다', () => {
    expect(proseIssues('두 방식으로 나뉩니다.')).toContain('경어체 해설')
    expect(proseIssues('두 방식으로 나뉜다.')).not.toContain('경어체 해설')
  })

  it('문단 중간에 끼어든 면접 메타 해설을 잡는다', () => {
    expect(proseIssues('트랩은 소프트웨어 인터럽트다. 이 구분이 면접의 핵심이다.')).toContain(
      '면접 상황으로 설명',
    )
    expect(proseIssues('실무에서 락 경합을 측정한다.')).not.toContain('면접 상황으로 설명')
  })

  it('핵심이라고 선언하며 시작하는 문단을 잡는다', () => {
    expect(proseIssues('핵심은 빠른 실패다.')).toContain('핵심을 선언하며 시작')
    expect(proseIssues('빠른 실패가 자원 고갈을 막는다.')).not.toContain('핵심을 선언하며 시작')
  })

  it('catches an overlong sentence', () => {
    const long = `인덱스는 ${'가'.repeat(100)}이다.`
    expect(proseIssues(long).some((i) => i.startsWith('긴 문장'))).toBe(true)
  })

  /*
   * 못 가르는 것은 안 잡는다.
   *
   * "~할 수 있다"와 쉼표 연결을 넣었다가 뺐다. 기준선 30개가 네 군데 걸렸는데
   * 전부 검사기가 틀린 쪽이었다 — "ACK가 유실될 수 있다"는 진짜 가능성이고,
   * "격리되고, 돌고, 쓴다"는 병렬 열거다. 금지할 것과 허용할 것의 문장 모양이
   * 같아서 패턴으로는 못 가른다.
   */
  it('leaves possibility and enumeration alone', () => {
    expect(proseIssues('마지막 ACK가 유실될 수 있기 때문이다.')).toEqual([])
    expect(proseIssues('코드, 데이터, 스택 영역을 구분하여 보호한다.')).toEqual([])
  })

  it('passes a clean sentence', () => {
    expect(proseIssues('인덱스가 있어도 옵티마이저가 전체 스캔을 고르는 때가 있다.')).toEqual([])
  })
})

/**
 * 손으로 쓴 30개가 기준선이다.
 *
 * 검사기가 기준선을 걸면 검사기가 틀린 것이다. 생성 규칙은 이 30개를 흉내
 * 내라는 것이고, 기준선이 못 지나는 문턱은 아무도 못 지난다.
 */
describe('손으로 쓴 예시', () => {
  it('passes its own style check', () => {
    const bad: string[] = []
    for (const n of EXAMPLE_NODES) {
      for (const b of parseBlocks(n.body)) {
        if (b.type !== 'paragraph') continue
        const issues = proseIssues(b.text)
        if (issues.length > 0) bad.push(`${n.question} :: ${issues.join(',')}`)
      }
    }
    expect(bad).toEqual([])
  })
})
