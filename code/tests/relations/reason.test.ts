import { describe, expect, it } from 'vitest'
import { normalizeRelationReason } from '@/lib/relations/reason'

describe('관련 질문 근거 말투', () => {
  it('이미 저장된 경어체도 화면에 내보내기 전에 평어체로 맞춘다', () => {
    expect(normalizeRelationReason('두 질문은 같은 원리를 다루고 있습니다.')).toBe(
      '두 질문은 같은 원리를 다루고 있다.',
    )
  })

  it('평어체 근거는 그대로 둔다', () => {
    expect(normalizeRelationReason('둘 다 연결 수립 비용을 다룬다.')).toBe(
      '둘 다 연결 수립 비용을 다룬다.',
    )
  })

  it('형용사형 종결을 동사형으로 잘못 바꾸지 않는다', () => {
    expect(normalizeRelationReason('락의 동작에 대한 이해가 필요합니다.')).toBe(
      '락의 동작에 대한 이해가 필요하다.',
    )
  })
})
