import { describe, expect, it } from 'vitest'
import { assembleGithubEvidence } from '@/lib/personalize/github-assembly'
import { buildGithubEvidenceContext } from '@/lib/personalize/github-context'
import type { GithubEvidenceBlobRequest } from '@/lib/personalize/github-plan'

const README_SHA = 'a'.repeat(40)
const PACKAGE_SHA = 'b'.repeat(40)

function request(
  path: string,
  sha: string,
  size: number,
  kind: GithubEvidenceBlobRequest['kind'],
): GithubEvidenceBlobRequest {
  return {
    path,
    sha,
    size,
    kind,
    url: `https://api.github.com/repos/example/repo/git/blobs/${sha}`,
  }
}

function response(sha: string, content: string) {
  const bytes = Buffer.from(content, 'utf8')
  return {
    sha,
    size: bytes.byteLength,
    encoding: 'base64',
    content: bytes.toString('base64'),
  }
}

describe('GitHub 근거 응답 조립', () => {
  it('선택 계획과 일치하는 응답만 모델 근거로 만든다', () => {
    const readme = '# 설명\n문의: maintainer@example.com'
    const packageJson = '{"dependencies":{"next":"16"}}'
    const requests = [
      request('README.md', README_SHA, Buffer.byteLength(readme), 'overview'),
      request('package.json', PACKAGE_SHA, Buffer.byteLength(packageJson), 'dependencies'),
    ]
    const result = assembleGithubEvidence(requests, [
      response(README_SHA, readme),
      response(PACKAGE_SHA, packageJson),
    ])

    expect(result).toEqual({
      ok: true,
      evidence: [
        { path: 'README.md', content: readme },
        { path: 'package.json', content: packageJson },
      ],
    })
    if (result.ok) {
      const context = buildGithubEvidenceContext(result.evidence)
      expect(context.context).not.toContain('maintainer@example.com')
      expect(context.files).toHaveLength(2)
    }
  })

  it.each([{ responses: [] }, { responses: [{}, {}] }])(
    '응답이 누락되거나 추가되면 부분 근거를 만들지 않는다',
    ({ responses }) => {
      const content = '# 설명'
      const requests = [
        request('README.md', README_SHA, Buffer.byteLength(content), 'overview'),
      ]
      expect(assembleGithubEvidence(requests, responses)).toMatchObject({
        ok: false,
        code: 'response_count',
      })
    },
  )

  it('중간 blob이 잘못되면 앞 파일도 반환하지 않는다', () => {
    const first = '# 설명'
    const second = '{}'
    const requests = [
      request('README.md', README_SHA, Buffer.byteLength(first), 'overview'),
      request('package.json', PACKAGE_SHA, Buffer.byteLength(second), 'dependencies'),
    ]
    const result = assembleGithubEvidence(requests, [
      response(README_SHA, first),
      response('c'.repeat(40), second),
    ])

    expect(result).toMatchObject({ ok: false, code: 'invalid_blob', index: 1 })
    expect(result).not.toHaveProperty('evidence')
  })

  it.each([
    { requests: [request('../package.json', PACKAGE_SHA, 2, 'dependencies')] },
    {
      requests: [
        request('README.md', README_SHA, 1, 'overview'),
        request('README.md', PACKAGE_SHA, 1, 'overview'),
      ],
    },
    { requests: [request('README.md', README_SHA, 1, 'dependencies')] },
  ])('경로·중복·분류가 변조된 계획을 거부한다', ({ requests }) => {
    expect(assembleGithubEvidence(requests, requests.map(() => ({})))).toMatchObject({
      ok: false,
      code: 'invalid_plan',
    })
  })

  it('빈 계획은 외부 원문 없이 완료된다', () => {
    expect(assembleGithubEvidence([], [])).toEqual({ ok: true, evidence: [] })
  })
})
