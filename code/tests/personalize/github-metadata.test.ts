import { describe, expect, it } from 'vitest'
import { validatePublicGithubRepository } from '@/lib/personalize/github-metadata'

const repo = {
  owner: 'J-nowcow',
  repo: 'cs-pathfinder',
  canonicalUrl: 'https://github.com/J-nowcow/cs-pathfinder',
}

const metadata = {
  private: false,
  visibility: 'public',
  disabled: false,
  full_name: 'J-nowcow/cs-pathfinder',
  default_branch: 'main',
}

describe('공개 GitHub 레포 메타데이터', () => {
  it('요청한 공개 레포의 기본 브랜치만 꺼낸다', () => {
    expect(validatePublicGithubRepository(repo, metadata)).toEqual({
      ok: true,
      value: { defaultBranch: 'main' },
    })
  })

  it('GitHub의 대소문자 정규화는 같은 레포로 인정한다', () => {
    expect(
      validatePublicGithubRepository(repo, { ...metadata, full_name: 'j-NOWCOW/CS-PATHFINDER' }),
    ).toEqual({ ok: true, value: { defaultBranch: 'main' } })
  })

  it.each([
    { private: true, visibility: 'private' },
    { private: false, visibility: 'internal' },
  ])('비공개 레포 응답은 분석 전에 거부한다: %o', (privacy) => {
    const result = validatePublicGithubRepository(repo, { ...metadata, ...privacy })
    expect(result).toMatchObject({ ok: false, code: 'not_public' })
  })

  it.each([
    { private: undefined },
    { visibility: undefined },
  ])('공개 여부 필드가 불완전하면 공개라고 추정하지 않는다: %o', (missing) => {
    const result = validatePublicGithubRepository(repo, { ...metadata, ...missing })
    expect(result).toMatchObject({ ok: false, code: 'invalid_response' })
  })

  it('다른 레포의 응답이 섞이면 거부한다', () => {
    const result = validatePublicGithubRepository(repo, {
      ...metadata,
      full_name: 'someone/other-repo',
    })
    expect(result).toMatchObject({ ok: false, code: 'invalid_response' })
  })

  it.each(['', ' main', 'main\nattack', 'a'.repeat(256)])(
    '비정상 기본 브랜치를 거부한다: %o',
    (defaultBranch) => {
      const result = validatePublicGithubRepository(repo, {
        ...metadata,
        default_branch: defaultBranch,
      })
      expect(result).toMatchObject({ ok: false, code: 'invalid_response' })
    },
  )

  it('비활성화된 레포를 별도 상태로 돌려준다', () => {
    const result = validatePublicGithubRepository(repo, { ...metadata, disabled: true })
    expect(result).toMatchObject({ ok: false, code: 'unavailable' })
  })
})
