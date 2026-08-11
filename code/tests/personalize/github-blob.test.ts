import { describe, expect, it } from 'vitest'
import { decodeGithubBlobResponse } from '@/lib/personalize/github-blob'
import { MAX_GITHUB_EVIDENCE_FILE_BYTES } from '@/lib/personalize/github-evidence'

const SHA = 'a'.repeat(40)

function response(content: Buffer, overrides: Record<string, unknown> = {}) {
  return {
    sha: SHA,
    size: content.byteLength,
    encoding: 'base64',
    content: content.toString('base64'),
    ...overrides,
  }
}

describe('GitHub blob 응답', () => {
  it('SHA와 바이트 크기가 맞는 UTF-8 텍스트만 꺼낸다', () => {
    const bytes = Buffer.from('안녕 GitHub', 'utf8')
    expect(decodeGithubBlobResponse({ sha: SHA, size: bytes.byteLength }, response(bytes))).toEqual({
      ok: true,
      content: '안녕 GitHub',
    })
  })

  it('GitHub가 줄바꿈한 Base64 응답을 읽는다', () => {
    const bytes = Buffer.from('architecture notes', 'utf8')
    const encoded = bytes.toString('base64')
    const wrapped = `${encoded.slice(0, 8)}\n${encoded.slice(8)}`
    const result = decodeGithubBlobResponse(
      { sha: SHA, size: bytes.byteLength },
      response(bytes, { content: wrapped }),
    )
    expect(result).toEqual({ ok: true, content: 'architecture notes' })
  })

  it.each([
    { overrides: { sha: 'b'.repeat(40) }, code: 'mismatch' },
    { overrides: { size: 999 }, code: 'mismatch' },
    { overrides: { encoding: 'utf-8' }, code: 'invalid_encoding' },
    { overrides: { content: '%%%%' }, code: 'invalid_encoding' },
  ])('트리 정보와 맞지 않는 응답을 거부한다: $code', ({ overrides, code }) => {
    const bytes = Buffer.from('README', 'utf8')
    const result = decodeGithubBlobResponse(
      { sha: SHA, size: bytes.byteLength },
      response(bytes, overrides),
    )
    expect(result).toMatchObject({ ok: false, code })
  })

  it('유효한 Base64여도 실제 바이트 크기가 다르면 거부한다', () => {
    const bytes = Buffer.from('README', 'utf8')
    const replacement = Buffer.from('SHORT', 'utf8')
    const result = decodeGithubBlobResponse(
      { sha: SHA, size: bytes.byteLength },
      response(bytes, { content: replacement.toString('base64') }),
    )
    expect(result).toMatchObject({ ok: false, code: 'mismatch' })
  })

  it('UTF-8 텍스트가 아닌 바이트를 거부한다', () => {
    const bytes = Buffer.from([0xff, 0xfe])
    const result = decodeGithubBlobResponse(
      { sha: SHA, size: bytes.byteLength },
      response(bytes),
    )
    expect(result).toMatchObject({ ok: false, code: 'not_text' })
  })

  it('선택 단계의 파일 크기 상한을 다시 적용한다', () => {
    const result = decodeGithubBlobResponse(
      { sha: SHA, size: MAX_GITHUB_EVIDENCE_FILE_BYTES + 1 },
      {},
    )
    expect(result).toMatchObject({ ok: false, code: 'invalid_reference' })
  })

  it('줄바꿈으로 부풀린 응답도 디코딩 전에 거부한다', () => {
    const bytes = Buffer.from('README', 'utf8')
    const result = decodeGithubBlobResponse(
      { sha: SHA, size: bytes.byteLength },
      response(bytes, { content: `${'\n'.repeat(1_000)}${bytes.toString('base64')}` }),
    )
    expect(result).toMatchObject({ ok: false, code: 'invalid_encoding' })
  })
})
