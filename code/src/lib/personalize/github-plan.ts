import {
  selectGithubEvidence,
  type GithubEvidenceFile,
} from '@/lib/personalize/github-evidence'
import type { GithubRepoRef } from '@/lib/personalize/github-source'
import type { GithubTreeSnapshot, VerifiedGithubTreeEntry } from '@/lib/personalize/github-tree'

export type GithubEvidenceBlobRequest = GithubEvidenceFile & {
  sha: string
  url: string
}

export type GithubEvidencePlanResult =
  | { ok: true; requests: GithubEvidenceBlobRequest[] }
  | { ok: false; code: 'invalid_tree'; detail: string }

const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i

function matchingEntry(
  entries: VerifiedGithubTreeEntry[],
  selected: GithubEvidenceFile,
): VerifiedGithubTreeEntry | undefined {
  return entries.find(
    (entry) =>
      entry.type === 'blob' && entry.path === selected.path && entry.size === selected.size,
  )
}

/**
 * 검증된 트리에서 고른 근거 파일을 immutable blob 조회 계획으로 바꾼다.
 *
 * 기본 브랜치의 contents URL을 쓰지 않는다. 트리를 읽은 뒤 브랜치가 바뀌면
 * 선택 당시와 다른 파일을 받을 수 있기 때문이다. Git blob SHA를 URL에 넣어
 * 선택·조회·디코딩이 같은 객체를 가리키게 한다.
 */
export function buildGithubEvidencePlan(
  repo: GithubRepoRef,
  snapshot: GithubTreeSnapshot,
): GithubEvidencePlanResult {
  const selected = selectGithubEvidence(snapshot.entries)
  const requests: GithubEvidenceBlobRequest[] = []

  for (const file of selected) {
    const entry = matchingEntry(snapshot.entries, file)
    if (!entry || !GIT_OBJECT_ID.test(entry.sha)) {
      return {
        ok: false,
        code: 'invalid_tree',
        detail: '선택한 파일의 Git 객체를 확인할 수 없습니다.',
      }
    }

    const owner = encodeURIComponent(repo.owner)
    const name = encodeURIComponent(repo.repo)
    requests.push({
      ...file,
      sha: entry.sha,
      url: `https://api.github.com/repos/${owner}/${name}/git/blobs/${entry.sha}`,
    })
  }

  return { ok: true, requests }
}
