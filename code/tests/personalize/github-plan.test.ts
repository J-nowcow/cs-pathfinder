import { describe, expect, it } from 'vitest'
import { buildGithubEvidencePlan } from '@/lib/personalize/github-plan'
import type { GithubTreeSnapshot, VerifiedGithubTreeEntry } from '@/lib/personalize/github-tree'

const repo = {
  owner: 'J-nowcow',
  repo: 'cs-pathfinder',
  canonicalUrl: 'https://github.com/J-nowcow/cs-pathfinder',
}
const TREE_SHA = 'a'.repeat(40)

function blob(path: string, sha: string, size = 1_000): VerifiedGithubTreeEntry {
  return { path, sha, size, mode: '100644', type: 'blob' }
}

function snapshot(entries: VerifiedGithubTreeEntry[]): GithubTreeSnapshot {
  return { sha: TREE_SHA, entries }
}

describe('GitHub 근거 조회 계획', () => {
  it('선택된 파일만 우선순위대로 immutable blob URL에 연결한다', () => {
    const readmeSha = 'b'.repeat(40)
    const packageSha = 'c'.repeat(40)
    const result = buildGithubEvidencePlan(
      repo,
      snapshot([
        blob('src/index.ts', 'd'.repeat(40)),
        blob('package.json', packageSha),
        blob('README.md', readmeSha),
      ]),
    )

    expect(result).toEqual({
      ok: true,
      requests: [
        {
          path: 'README.md',
          size: 1_000,
          kind: 'overview',
          sha: readmeSha,
          url: `https://api.github.com/repos/J-nowcow/cs-pathfinder/git/blobs/${readmeSha}`,
        },
        {
          path: 'package.json',
          size: 1_000,
          kind: 'dependencies',
          sha: packageSha,
          url: `https://api.github.com/repos/J-nowcow/cs-pathfinder/git/blobs/${packageSha}`,
        },
      ],
    })
  })

  it('브랜치명과 파일 경로를 조회 URL에 넣지 않는다', () => {
    const sha = 'b'.repeat(40)
    const result = buildGithubEvidencePlan(repo, snapshot([blob('docs/architecture.md', sha)]))
    expect(result.ok).toBe(true)
    if (result.ok) {
      const url = new URL(result.requests[0].url)
      expect(url.origin).toBe('https://api.github.com')
      expect(url.pathname.endsWith(`/git/blobs/${sha}`)).toBe(true)
      expect(url.href).not.toContain('architecture.md')
      expect(url.href).not.toContain('main')
    }
  })

  it('근거 대상이 없으면 외부 요청도 계획하지 않는다', () => {
    expect(buildGithubEvidencePlan(repo, snapshot([blob('src/index.ts', 'b'.repeat(40))]))).toEqual({
      ok: true,
      requests: [],
    })
  })

  it('검증 타입을 우회한 잘못된 SHA는 URL로 만들지 않는다', () => {
    const entry = blob('README.md', 'not-a-sha')
    const result = buildGithubEvidencePlan(repo, snapshot([entry]))
    expect(result).toMatchObject({ ok: false, code: 'invalid_tree' })
  })

  it('중복 경로에서는 선택 당시의 첫 객체를 유지한다', () => {
    const firstSha = 'b'.repeat(40)
    const result = buildGithubEvidencePlan(
      repo,
      snapshot([blob('README.md', firstSha), blob('README.md', 'c'.repeat(40))]),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.requests[0].sha).toBe(firstSha)
  })
})
