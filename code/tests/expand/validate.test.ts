import { describe, it, expect } from 'vitest'
import { redactSuspectedPii, validateRawInput } from '@/lib/expand/validate'

describe('validateRawInput', () => {
  it('accepts a normal question', () => {
    const r = validateRawInput('pool size는 왜 코어 수 기준인가요?')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('pool size는 왜 코어 수 기준인가요?')
  })

  it('trims surrounding whitespace', () => {
    const r = validateRawInput('   인덱스가 왜 안 타나요?   ')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('인덱스가 왜 안 타나요?')
  })

  it('rejects empty input', () => {
    const r = validateRawInput('    ')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('empty')
  })

  it('rejects input longer than 300 chars', () => {
    const r = validateRawInput('가'.repeat(301))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('too_long')
  })

  it('rejects control characters', () => {
    const r = validateRawInput('질문입니다')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('control_chars')
  })

  it('allows newlines', () => {
    expect(validateRawInput('첫 줄\n둘째 줄').ok).toBe(true)
  })

  it('rejects an email address', () => {
    const r = validateRawInput('제 메일 hong@example.com 로 답 주세요')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('pii_suspected')
  })

  it('rejects a phone number', () => {
    const r = validateRawInput('연락처는 010-1234-5678 입니다')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('pii_suspected')
  })

  it('does not flag a plain technical number', () => {
    expect(validateRawInput('pool size 20이면 어떻게 되나요?').ok).toBe(true)
  })

  it('연락처를 모델 입력 전에 가릴 수 있다', () => {
    expect(redactSuspectedPii('메일 hong@example.com, 전화 010-1234-5678')).toBe(
      '메일 [개인정보 제거], 전화 [개인정보 제거]',
    )
  })
})
