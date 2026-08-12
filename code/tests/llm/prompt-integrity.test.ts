import { describe, it, expect } from 'vitest'
import { SYSTEM as EXPAND_SYSTEM } from '@/lib/llm/generate'
import { SYSTEM as DAILY_SYSTEM } from '@/lib/daily/generate'

/**
 * 프롬프트가 통째로 실려 있는가.
 *
 * 프롬프트는 템플릿 리터럴이라 규칙에 백틱을 쓰면 문자열이 거기서 끊긴다.
 * 홀수 개면 타입 검사가 잡지만 **짝수 개면 조용히 통과한다** — 리터럴이
 * 닫혔다 다시 열리면서 그 사이 규칙이 문자열 밖으로 빠진다. 컴파일도 되고
 * 시험도 통과하는데 모델은 그 규칙을 못 본다.
 *
 * 실제로 규칙을 넣다가 백틱 때문에 두 번 깨졌다. 두 번 다 타입 검사가
 * 잡았지만 그건 운이었다.
 *
 * 그래서 규칙마다 표식을 확인한다. 프롬프트에서 규칙을 빼면 이 시험이
 * 먼저 깨진다.
 */
const EXPAND_MARKS = [
  '중심 주장 하나',
  '도식을 가리키며 해설하지 않는다',
  '꼬리질문으로는',
  '평어체',
  '150자',
  '첫 문단 바로 뒤',
  ':::flow',
  ':::state',
  ':::tree',
  ':::timeline',
  ':::stack',
  '35자',
  '통해',
  '따라서',
  '해야 한다',
  '것이 핵심이다',
  /*
   * 표가 기본값이 되지 않게 막는 규칙. 견주는 질문이 아닌데도 표만 있는
   * 편이 103편(33%)이었다. 이 표식이 빠지면 그 상태로 돌아간다.
   */
  '기본값이 아니다',
]

const DAILY_MARKS = [
  '40자',
  '중심 주장 하나',
  '도식을 가리키며 해설하지 않는다',
  '꼬리질문으로는',
  '평어체',
  '150자',
  ':::flow',
  ':::state',
  ':::tree',
  ':::timeline',
  '35자',
  '통해',
  '따라서',
  '것이 핵심이다',
  '기본값이 아니다',
]

describe('프롬프트가 잘리지 않았는가', () => {
  it('keeps every rule marker in the expand prompt', () => {
    const missing = EXPAND_MARKS.filter((m) => !EXPAND_SYSTEM.includes(m))
    expect(missing).toEqual([])
  })

  it('keeps every rule marker in the daily prompt', () => {
    const missing = DAILY_MARKS.filter((m) => !DAILY_SYSTEM.includes(m))
    expect(missing).toEqual([])
  })

  /**
   * 길이로도 본다. 표식은 앞쪽에 몰려 있을 수 있어서, 뒤가 잘려도 표식만으로는
   * 안 잡힌다. 규칙을 늘릴 일은 있어도 절반으로 줄 일은 없다.
   */
  it('is not suddenly much shorter', () => {
    expect(EXPAND_SYSTEM.length).toBeGreaterThan(2000)
    expect(DAILY_SYSTEM.length).toBeGreaterThan(2000)
  })

  /** 규칙 안의 백틱은 반드시 이스케이프되어야 문자열에 남는다 */
  it('carries backticked examples through', () => {
    expect(EXPAND_SYSTEM).toContain('`~를 통해`')
    expect(DAILY_SYSTEM).toContain('`~를 통해`')
  })
})
