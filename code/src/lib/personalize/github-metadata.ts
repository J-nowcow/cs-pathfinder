import type { GithubRepoRef } from '@/lib/personalize/github-source'

export type PublicGithubRepository = {
  defaultBranch: string
}

export type GithubMetadataResult =
  | { ok: true; value: PublicGithubRepository }
  | {
      ok: false
      code: 'not_public' | 'unavailable' | 'invalid_response'
      detail: string
    }

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * GitHub 저장소 조회 응답이 사용자가 요청한 공개 레포인지 확인한다.
 *
 * URL 모양만으로 공개 여부를 믿지 않는다. 인증 토큰이 나중에 추가돼도 비공개
 * 레포 응답은 이 경계에서 막힌다. 응답의 full_name도 원래 입력과 대조해 다른
 * 레포의 자료가 섞이는 것을 방지한다.
 */
export function validatePublicGithubRepository(
  repo: GithubRepoRef,
  input: unknown,
): GithubMetadataResult {
  if (!isRecord(input)) {
    return { ok: false, code: 'invalid_response', detail: 'GitHub 응답 형식이 올바르지 않습니다.' }
  }

  if (input.private === true || input.visibility === 'private' || input.visibility === 'internal') {
    return { ok: false, code: 'not_public', detail: '공개 GitHub 레포만 분석할 수 있습니다.' }
  }

  if (input.private !== false || input.visibility !== 'public') {
    return { ok: false, code: 'invalid_response', detail: '레포 공개 여부를 확인할 수 없습니다.' }
  }

  if (input.disabled === true) {
    return { ok: false, code: 'unavailable', detail: '현재 접근할 수 없는 GitHub 레포입니다.' }
  }

  const expectedName = `${repo.owner}/${repo.repo}`.toLocaleLowerCase('en-US')
  if (
    typeof input.full_name !== 'string' ||
    input.full_name.toLocaleLowerCase('en-US') !== expectedName
  ) {
    return { ok: false, code: 'invalid_response', detail: '요청한 레포와 GitHub 응답이 다릅니다.' }
  }

  if (
    typeof input.default_branch !== 'string' ||
    input.default_branch.length === 0 ||
    input.default_branch.length > 255 ||
    input.default_branch.trim() !== input.default_branch ||
    CONTROL_CHARACTER.test(input.default_branch)
  ) {
    return { ok: false, code: 'invalid_response', detail: '기본 브랜치를 확인할 수 없습니다.' }
  }

  return { ok: true, value: { defaultBranch: input.default_branch } }
}
