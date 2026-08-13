import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../../src/app/(site)/page.tsx', import.meta.url), 'utf8')
const resume = readFileSync(
  new URL('../../src/components/ResumeQuestionMaker.tsx', import.meta.url),
  'utf8',
)

describe('취준생의 첫 화면', () => {
  it('CS 면접 준비와 오늘 할 일을 먼저 말한다', () => {
    expect(home).toContain('CS 면접 공부')
    expect(home).toContain('오늘 질문부터')
    expect(home).toContain('먼저 답을 떠올려 보고')
  })

  it('키워드와 레쥬메에서 질문을 찾는 두 입구를 바로 제공한다', () => {
    expect(home).toContain('href="/glossary"')
    expect(home).toContain('href="/me#resume-questions"')
    expect(resume).toContain('id="resume-questions"')
  })
})
