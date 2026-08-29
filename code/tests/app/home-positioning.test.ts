import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../../src/app/(site)/page.tsx', import.meta.url), 'utf8')
const resume = readFileSync(
  new URL('../../src/components/ResumeQuestionMaker.tsx', import.meta.url),
  'utf8',
)
const layout = readFileSync(new URL('../../src/app/layout.tsx', import.meta.url), 'utf8')

describe('취준생의 첫 화면', () => {
  it('CS 면접 준비와 오늘 할 일을 먼저 말한다', () => {
    expect(home).toContain('CS 면접 공부')
    expect(home).toContain('오늘 질문부터')
    expect(home).toContain('먼저 답을 떠올려 보고')
    expect(layout).toContain('취준생용 학습 지도')
  })

  it('키워드와 레쥬메에서 질문을 찾는 두 입구를 바로 제공한다', () => {
    expect(home).toContain('href="/glossary"')
    expect(home).toContain('href="/me#resume-questions"')
    expect(resume).toContain('id="resume-questions"')
  })

  it('읽기 전에 오늘 답할 세 문제를 먼저 제시한다', () => {
    expect(home).toContain('<DailyLearningCard')
    expect(home.indexOf('<DailyLearningCard')).toBeLessThan(home.indexOf('<TodayCard'))
  })

  /**
   * **카드 하나가 첫 화면을 죽이지 못하게 한다.**
   *
   * `resolveTrackQuestions`는 깨진 참조를 일부러 던지고 그 계약은 그대로
   * 둔다. 다만 홈이 받아내야 한다 — 등가 접기가 트랙 질문 두 개를 목록에서
   * 가리자 홈 전체가 500이 났다. 트랙 문장은 정적인데 말뭉치는 계속 움직여서
   * 다시 어긋날 수 있다.
   */
  it('트랙 해석이 깨져도 홈 전체를 죽이지 않는다', () => {
    expect(home).toMatch(/try\s*\{[\s\S]{0,200}resolveTrackQuestions[\s\S]{0,200}\}\s*catch/)
    // 실패했으면 빈 카드 대신 아예 안 그린다
    expect(home).toContain('trackQuestions.length > 0 &&')
  })
})
