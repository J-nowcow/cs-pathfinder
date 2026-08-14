import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const privacy = readFileSync(
  new URL('../../src/app/(site)/privacy/page.tsx', import.meta.url),
  'utf8',
)

describe('면접 답변 초안의 저장 고지', () => {
  it('브라우저에만 저장하고 외부로 보내지 않는다고 알린다', () => {
    expect(privacy).toContain('직접 적은 면접 답변 초안과 복습 표시')
    expect(privacy).toContain('서버나 계정에 보내지 않고 AI에도 전달하지 않습니다')
    expect(privacy).toContain('최근 100개')
    expect(privacy).toContain('초안 지우기')
    expect(privacy).toContain('맞춤 질문에 적은 답변')
    expect(privacy).toContain('맞춤 질문 5개와 그 답변')
  })

  it('질문을 연 기록을 실제 학습처럼 부르지 않는다', () => {
    expect(privacy).toContain('날짜별로 열어 본 질문 수')
    expect(privacy).not.toContain('몇 편을 파고들었는지')
  })

  it('오늘의 세 문제 스냅샷도 로컬 저장이라고 알린다', () => {
    expect(privacy).toContain('오늘 고른 질문 3개와 순서')
    expect(privacy).toContain('다음 날 새 학습 목록')
    expect(privacy).toContain('오늘의 3문제')
  })
})
