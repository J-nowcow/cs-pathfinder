import { describe, expect, it } from 'vitest'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { BACKEND_INTERVIEW_30 } from '../../data/learning-tracks'
import { NODE_LEVELS } from '../../data/node-levels'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'
import {
  estimatedTrackMinutes,
  resolveTrackQuestions,
  validateLearningTrack,
  type LearningTrack,
} from '@/lib/learning/tracks'

const corpus = [...EXAMPLE_NODES, ...GENERATED_NODES, ...AUTHORED_NODES, ...ON_DEMAND_NODES]
const questions = corpus.map((node) => node.question)

describe('백엔드 CS 면접 30 트랙', () => {
  it('현재 말뭉치의 서로 다른 질문 30개만 순서대로 참조한다', () => {
    expect(validateLearningTrack(BACKEND_INTERVIEW_30, questions)).toEqual([])
    expect(BACKEND_INTERVIEW_30.questionKeys).toHaveLength(30)
    expect(new Set(BACKEND_INTERVIEW_30.questionKeys)).toHaveLength(30)
    expect(BACKEND_INTERVIEW_30.questionKeys[0]).toBe('프로세스와 스레드의 핵심 차이는 무엇인가?')
    expect(BACKEND_INTERVIEW_30.questionKeys.at(-1)).toBe('요청이 한꺼번에 몰릴 때 어떻게 막는가?')
  })

  it('모든 질문에 난이도와 꼬리질문 5개가 있다', () => {
    const byQuestion = new Map(corpus.map((node) => [node.question, node]))
    const leveled = new Set(NODE_LEVELS.map((entry) => entry.question))

    for (const question of BACKEND_INTERVIEW_30.questionKeys) {
      expect(byQuestion.get(question)?.suggestions).toHaveLength(5)
      expect(leveled.has(question)).toBe(true)
    }
  })

  it('문제당 예상 시간으로 전체 시간을 계산한다', () => {
    expect(estimatedTrackMinutes(BACKEND_INTERVIEW_30)).toBe(150)
  })
})

describe('학습 트랙 검증과 해석', () => {
  const baseTrack: LearningTrack = {
    ...BACKEND_INTERVIEW_30,
    questionKeys: ['첫 질문', '둘째 질문'],
  }

  it('중복되거나 현재 말뭉치에 없는 질문을 함께 알려 준다', () => {
    const broken = { ...baseTrack, questionKeys: ['첫 질문', '첫 질문', '없는 질문'] }

    expect(validateLearningTrack(broken, ['첫 질문'])).toEqual([
      '질문이 중복되었습니다: 첫 질문',
      '현재 말뭉치에 없는 질문입니다: 없는 질문',
    ])
  })

  it('현재 노드 id로 바꾸되 트랙 순서를 지킨다', () => {
    expect(resolveTrackQuestions(baseTrack, [
      { id: 'q2', question: '둘째 질문' },
      { id: 'q1', question: '첫 질문' },
    ])).toEqual([
      { id: 'q1', question: '첫 질문', position: 1 },
      { id: 'q2', question: '둘째 질문', position: 2 },
    ])
  })

  it('깨진 참조를 조용히 누락하지 않는다', () => {
    expect(() => resolveTrackQuestions(baseTrack, [{ id: 'q1', question: '첫 질문' }]))
      .toThrow('현재 말뭉치에 없는 질문입니다: 둘째 질문')
  })
})
