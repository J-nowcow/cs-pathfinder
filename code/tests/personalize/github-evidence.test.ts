import { describe, expect, it } from 'vitest'
import {
  MAX_GITHUB_EVIDENCE_FILES,
  MAX_GITHUB_EVIDENCE_TOTAL_BYTES,
  selectGithubEvidence,
  type GithubTreeEntry,
} from '@/lib/personalize/github-evidence'

const blob = (path: string, size = 1_000): GithubTreeEntry => ({ path, size, type: 'blob' })

describe('GitHub 분석 근거 파일', () => {
  it('설명·설계·의존성·배포 파일만 우선순위대로 고른다', () => {
    expect(
      selectGithubEvidence([
        blob('src/index.ts'),
        blob('.github/workflows/test.yml'),
        blob('code/package.json'),
        blob('docs/architecture.md'),
        blob('README.md'),
      ]),
    ).toEqual([
      { path: 'README.md', size: 1_000, kind: 'overview' },
      { path: 'docs/architecture.md', size: 1_000, kind: 'architecture' },
      { path: 'code/package.json', size: 1_000, kind: 'dependencies' },
      { path: '.github/workflows/test.yml', size: 1_000, kind: 'deployment' },
    ])
  })

  it('비밀정보 후보·심볼릭 링크·큰 파일·일반 소스는 제외한다', () => {
    expect(
      selectGithubEvidence([
        blob('.env.production'),
        blob('docs/private-key.md'),
        blob('.env.production/package.json'),
        blob('secret/package.json'),
        { ...blob('README.md'), mode: '120000' },
        blob('package.json', 64_001),
        blob('src/server.ts'),
      ]),
    ).toEqual([])
  })

  it('중복 경로를 한 번만 고른다', () => {
    expect(selectGithubEvidence([blob('README.md'), blob('README.md')])).toHaveLength(1)
  })

  it('파일 개수 상한을 넘지 않는다', () => {
    const entries = Array.from({ length: MAX_GITHUB_EVIDENCE_FILES + 4 }, (_, i) =>
      blob(`app-${i}/package.json`, 1_000),
    )
    expect(selectGithubEvidence(entries)).toHaveLength(MAX_GITHUB_EVIDENCE_FILES)
  })

  it('전체 바이트 상한을 넘는 파일은 건너뛴다', () => {
    const selected = selectGithubEvidence([
      blob('README.md', 40_000),
      blob('docs/design.md', 40_000),
      blob('package.json', 40_000),
    ])

    expect(selected.map((file) => file.path)).toEqual(['README.md', 'docs/design.md'])
    expect(selected.reduce((sum, file) => sum + file.size, 0)).toBeLessThanOrEqual(
      MAX_GITHUB_EVIDENCE_TOTAL_BYTES,
    )
  })

  it('입력 순서와 무관하게 같은 결과를 낸다', () => {
    const entries = [blob('Dockerfile'), blob('README.md'), blob('package.json')]
    expect(selectGithubEvidence(entries)).toEqual(selectGithubEvidence([...entries].reverse()))
  })
})
