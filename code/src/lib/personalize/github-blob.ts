import { MAX_GITHUB_EVIDENCE_FILE_BYTES } from '@/lib/personalize/github-evidence'

export type GithubBlobRef = {
  sha: string
  size: number
}

export type GithubBlobResult =
  | { ok: true; content: string }
  | {
      ok: false
      code: 'invalid_reference' | 'mismatch' | 'invalid_encoding' | 'not_text'
      detail: string
    }

const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * GitHub blob 응답을 크기가 확인된 UTF-8 텍스트로만 디코딩한다.
 *
 * 트리에서 선택한 SHA와 크기를 다시 대조한다. 응답이 바뀌거나 잘못 연결돼도
 * 다른 파일 내용이 모델 근거로 섞이지 않는다. 디코딩 전 Base64 길이도 제한해
 * 큰 응답을 작은 파일처럼 속여 메모리를 쓰는 것을 막는다.
 */
export function decodeGithubBlobResponse(
  expected: GithubBlobRef,
  input: unknown,
): GithubBlobResult {
  if (
    !GIT_OBJECT_ID.test(expected.sha) ||
    !Number.isSafeInteger(expected.size) ||
    expected.size < 0 ||
    expected.size > MAX_GITHUB_EVIDENCE_FILE_BYTES
  ) {
    return { ok: false, code: 'invalid_reference', detail: '선택한 GitHub 파일 정보가 올바르지 않습니다.' }
  }

  if (
    !isRecord(input) ||
    typeof input.sha !== 'string' ||
    typeof input.size !== 'number' ||
    typeof input.encoding !== 'string' ||
    typeof input.content !== 'string'
  ) {
    return { ok: false, code: 'mismatch', detail: 'GitHub 파일 응답 형식이 올바르지 않습니다.' }
  }

  if (
    input.sha.toLocaleLowerCase('en-US') !== expected.sha.toLocaleLowerCase('en-US') ||
    input.size !== expected.size
  ) {
    return { ok: false, code: 'mismatch', detail: '선택한 파일과 GitHub 응답이 다릅니다.' }
  }
  if (input.encoding !== 'base64') {
    return { ok: false, code: 'invalid_encoding', detail: '지원하지 않는 GitHub 파일 인코딩입니다.' }
  }

  const expectedEncodedLength = Math.ceil(expected.size / 3) * 4
  // GitHub의 줄바꿈 여유는 주되, 줄바꿈만 큰 응답은 치환하기 전에 막는다.
  const maxWrappedLength = expectedEncodedLength + Math.ceil(expectedEncodedLength / 16) + 2
  if (input.content.length > maxWrappedLength) {
    return { ok: false, code: 'invalid_encoding', detail: 'GitHub 파일 인코딩이 너무 큽니다.' }
  }

  const encoded = input.content.replace(/[\r\n]/g, '')
  if (encoded.length !== expectedEncodedLength || !BASE64.test(encoded)) {
    return { ok: false, code: 'invalid_encoding', detail: 'GitHub 파일 인코딩이 올바르지 않습니다.' }
  }

  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.byteLength !== expected.size) {
    return { ok: false, code: 'mismatch', detail: 'GitHub 파일의 실제 크기가 다릅니다.' }
  }

  try {
    return { ok: true, content: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    return { ok: false, code: 'not_text', detail: '텍스트가 아닌 파일은 분석하지 않습니다.' }
  }
}
