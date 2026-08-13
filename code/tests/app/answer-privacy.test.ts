import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const privacy = readFileSync(
  new URL('../../src/app/(site)/privacy/page.tsx', import.meta.url),
  'utf8',
)

describe('면접 답변 초안의 저장 고지', () => {
  it('브라우저에만 저장하고 외부로 보내지 않는다고 알린다', () => {
    expect(privacy).toContain('직접 적은 면접 답변 초안')
    expect(privacy).toContain('서버나 계정에 보내지 않고 AI에도 전달하지 않습니다')
    expect(privacy).toContain('최근 100개')
    expect(privacy).toContain('초안 지우기')
  })
})
