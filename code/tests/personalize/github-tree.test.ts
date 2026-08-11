import { describe, expect, it } from 'vitest'
import { selectGithubEvidence } from '@/lib/personalize/github-evidence'
import {
  MAX_GITHUB_TREE_ENTRIES,
  validateGithubTreeResponse,
} from '@/lib/personalize/github-tree'

const SHA = 'a'.repeat(40)
const blob = (path: string, size = 1_000) => ({
  path,
  mode: '100644',
  type: 'blob',
  size,
  sha: SHA,
})

describe('GitHub 트리 응답', () => {
  it('검증된 항목을 기존 근거 선택기로 넘긴다', () => {
    const result = validateGithubTreeResponse({
      sha: SHA,
      truncated: false,
      tree: [blob('src/index.ts'), blob('README.md'), blob('package.json')],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(selectGithubEvidence(result.value.entries)).toEqual([
        { path: 'README.md', size: 1_000, kind: 'overview' },
        { path: 'package.json', size: 1_000, kind: 'dependencies' },
      ])
    }
  })

  it('잘린 재귀 트리를 불완전한 근거로 사용하지 않는다', () => {
    const result = validateGithubTreeResponse({ sha: SHA, truncated: true, tree: [] })
    expect(result).toMatchObject({ ok: false, code: 'truncated' })
  })

  it('완전성 표시가 없으면 완전하다고 추정하지 않는다', () => {
    const result = validateGithubTreeResponse({ sha: SHA, tree: [] })
    expect(result).toMatchObject({ ok: false, code: 'invalid_response' })
  })

  it('서브모듈은 현재 공개 레포 범위 밖이라 제외한다', () => {
    const result = validateGithubTreeResponse({
      sha: SHA,
      truncated: false,
      tree: [{ ...blob('vendor/module'), type: 'commit', mode: '160000' }],
    })
    expect(result).toEqual({ ok: true, value: { sha: SHA, entries: [] } })
  })

  it.each([
    { ...blob('README.md'), sha: 'not-a-sha' },
    { ...blob('README.md'), size: -1 },
    { ...blob('README.md'), type: 'unknown' },
    null,
  ])('비정상 트리 항목을 거부한다: %o', (entry) => {
    const result = validateGithubTreeResponse({ sha: SHA, truncated: false, tree: [entry] })
    expect(result).toMatchObject({ ok: false, code: 'invalid_response' })
  })

  it('공식 재귀 트리 항목 상한을 넘는 응답을 거부한다', () => {
    const result = validateGithubTreeResponse({
      sha: SHA,
      truncated: false,
      tree: Array(MAX_GITHUB_TREE_ENTRIES + 1).fill(blob('README.md')),
    })
    expect(result).toMatchObject({ ok: false, code: 'too_large' })
  })
})
