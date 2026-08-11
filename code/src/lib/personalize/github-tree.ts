import type { GithubTreeEntry } from '@/lib/personalize/github-evidence'

export const MAX_GITHUB_TREE_ENTRIES = 100_000

export type VerifiedGithubTreeEntry = GithubTreeEntry & {
  sha: string
  mode: string
}

export type GithubTreeSnapshot = {
  sha: string
  entries: VerifiedGithubTreeEntry[]
}

export type GithubTreeResult =
  | { ok: true; value: GithubTreeSnapshot }
  | {
      ok: false
      code: 'truncated' | 'too_large' | 'invalid_response'
      detail: string
    }

const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * GitHub 재귀 트리 응답을 근거 파일 선택기가 읽을 수 있는 형태로 좁힌다.
 *
 * GitHub는 큰 재귀 트리를 잘라서 돌려줄 수 있다. 그 상태를 완전한 레포처럼
 * 분석하면 중요한 설계 파일이 빠졌는지 알 수 없으므로 명시적으로 중단한다.
 * 서브모듈(commit)은 외부 레포를 가리키므로 분석 범위에 넣지 않는다.
 */
export function validateGithubTreeResponse(input: unknown): GithubTreeResult {
  if (
    !isRecord(input) ||
    typeof input.sha !== 'string' ||
    !GIT_OBJECT_ID.test(input.sha) ||
    !Array.isArray(input.tree)
  ) {
    return { ok: false, code: 'invalid_response', detail: 'GitHub 트리 응답 형식이 올바르지 않습니다.' }
  }

  if (input.truncated === true) {
    return { ok: false, code: 'truncated', detail: '레포가 커서 전체 파일 목록을 확인하지 못했습니다.' }
  }
  if (input.truncated !== false) {
    return { ok: false, code: 'invalid_response', detail: '트리 완전성을 확인할 수 없습니다.' }
  }
  if (input.tree.length > MAX_GITHUB_TREE_ENTRIES) {
    return { ok: false, code: 'too_large', detail: '분석할 수 있는 레포 크기를 넘었습니다.' }
  }

  const entries: VerifiedGithubTreeEntry[] = []
  for (const item of input.tree) {
    if (!isRecord(item)) {
      return { ok: false, code: 'invalid_response', detail: 'GitHub 트리 항목 형식이 올바르지 않습니다.' }
    }

    // 서브모듈은 다른 레포의 커밋을 가리킨다. 현재 공개 레포 경계를 넘지 않는다.
    if (item.type === 'commit') continue
    if (item.type !== 'blob' && item.type !== 'tree') {
      return { ok: false, code: 'invalid_response', detail: '알 수 없는 GitHub 트리 항목입니다.' }
    }
    if (
      typeof item.path !== 'string' ||
      typeof item.mode !== 'string' ||
      typeof item.sha !== 'string' ||
      !GIT_OBJECT_ID.test(item.sha)
    ) {
      return { ok: false, code: 'invalid_response', detail: 'GitHub 트리 항목이 불완전합니다.' }
    }
    if (
      item.size !== undefined &&
      (!Number.isSafeInteger(item.size) || (item.size as number) < 0)
    ) {
      return { ok: false, code: 'invalid_response', detail: 'GitHub 파일 크기가 올바르지 않습니다.' }
    }

    entries.push({
      path: item.path,
      type: item.type,
      size: item.size as number | undefined,
      mode: item.mode,
      sha: item.sha,
    })
  }

  return { ok: true, value: { sha: input.sha, entries } }
}
