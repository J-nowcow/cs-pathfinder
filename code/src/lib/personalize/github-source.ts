export type GithubRepoRef = {
  owner: string
  repo: string
  canonicalUrl: string
}

export type GithubRepoErrorCode =
  | 'empty'
  | 'invalid_url'
  | 'unsupported_host'
  | 'not_repository'

export type GithubRepoResult =
  | { ok: true; value: GithubRepoRef }
  | { ok: false; code: GithubRepoErrorCode; detail: string }

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/

/**
 * 공개 GitHub 레포 입력을 API 호출에 쓸 owner/repo로 좁힌다.
 *
 * 서버가 사용자가 준 URL을 그대로 fetch하면 내부 주소나 다른 호스트로 요청을
 * 보낼 수 있다. 여기서는 github.com의 레포 루트만 받고 이후 호출은 반환된
 * owner/repo로 GitHub API 주소를 새로 만들게 한다.
 */
export function parseGithubRepo(input: string): GithubRepoResult {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return { ok: false, code: 'empty', detail: 'GitHub 레포 주소를 입력해 주세요.' }
  }

  const candidate = trimmed.startsWith('github.com/') ? `https://${trimmed}` : trimmed

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, code: 'invalid_url', detail: '올바른 GitHub 주소가 아닙니다.' }
  }

  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    return {
      ok: false,
      code: 'unsupported_host',
      detail: '공개 github.com 레포만 분석할 수 있습니다.',
    }
  }

  if (url.username || url.password || url.port) {
    return { ok: false, code: 'invalid_url', detail: '인증정보나 포트가 없는 주소를 입력해 주세요.' }
  }

  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length !== 2) {
    return {
      ok: false,
      code: 'not_repository',
      detail: '파일이나 브랜치가 아닌 레포 첫 화면 주소를 입력해 주세요.',
    }
  }

  let owner: string
  let repo: string
  try {
    owner = decodeURIComponent(segments[0])
    repo = decodeURIComponent(segments[1]).replace(/\.git$/i, '')
  } catch {
    return { ok: false, code: 'invalid_url', detail: '올바른 GitHub 주소가 아닙니다.' }
  }

  if (!SAFE_SEGMENT.test(owner) || !SAFE_SEGMENT.test(repo) || owner === '.' || repo === '.') {
    return { ok: false, code: 'not_repository', detail: '올바른 GitHub 레포 주소가 아닙니다.' }
  }

  return {
    ok: true,
    value: {
      owner,
      repo,
      canonicalUrl: `https://github.com/${owner}/${repo}`,
    },
  }
}
