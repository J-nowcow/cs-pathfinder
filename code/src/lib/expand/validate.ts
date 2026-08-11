export type ValidationErrorCode = 'empty' | 'too_long' | 'control_chars' | 'pii_suspected'

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; code: ValidationErrorCode; detail: string }

export const MAX_INPUT_LENGTH = 300

// 개행(\n)과 탭(\t)은 허용하고 나머지 제어문자는 막는다.
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/
const PHONE = /\d{2,3}[-\s]\d{3,4}[-\s]\d{4}/

export function containsUnsafeControlChars(input: string): boolean {
  return CONTROL_CHARS.test(input)
}

export function containsSuspectedPii(input: string): boolean {
  return EMAIL.test(input) || PHONE.test(input)
}

export function redactSuspectedPii(input: string): string {
  return input
    .replace(new RegExp(EMAIL.source, 'g'), '[개인정보 제거]')
    .replace(new RegExp(PHONE.source, 'g'), '[개인정보 제거]')
}

/**
 * LLM 호출 전에 건다.
 *
 * 무료 티어는 입력이 모델 학습에 사용되고 약관이 개인정보 제출을 금지한다.
 * 익명 사용자가 무엇을 입력할지 통제할 수 없으므로 여기서 최소 방어를 한다.
 */
export function validateRawInput(input: string): ValidationResult {
  const trimmed = input.trim()

  if (trimmed.length === 0) {
    return { ok: false, code: 'empty', detail: '질문을 입력해 주세요.' }
  }

  if (trimmed.length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      code: 'too_long',
      detail: `질문은 ${MAX_INPUT_LENGTH}자까지 입력할 수 있습니다.`,
    }
  }

  if (containsUnsafeControlChars(trimmed)) {
    return { ok: false, code: 'control_chars', detail: '허용되지 않는 문자가 포함되어 있습니다.' }
  }

  if (containsSuspectedPii(trimmed)) {
    return {
      ok: false,
      code: 'pii_suspected',
      detail: '개인정보로 보이는 내용이 있습니다. 입력은 AI 학습에 사용될 수 있으니 제외해 주세요.',
    }
  }

  return { ok: true, value: trimmed }
}
