import { decodeGithubBlobResponse } from '@/lib/personalize/github-blob'
import type { GithubEvidenceContent } from '@/lib/personalize/github-context'
import { selectGithubEvidence } from '@/lib/personalize/github-evidence'
import type { GithubEvidenceBlobRequest } from '@/lib/personalize/github-plan'

export type GithubEvidenceAssemblyResult =
  | { ok: true; evidence: GithubEvidenceContent[] }
  | {
      ok: false
      code: 'invalid_plan' | 'response_count' | 'invalid_blob'
      detail: string
      index?: number
    }

function isValidPlan(requests: GithubEvidenceBlobRequest[]): boolean {
  const selected = selectGithubEvidence(
    requests.map(({ path, size }) => ({ path, size, type: 'blob' as const })),
  )

  return (
    selected.length === requests.length &&
    selected.every((file, index) => {
      const request = requests[index]
      return (
        file.path === request.path && file.size === request.size && file.kind === request.kind
      )
    })
  )
}

/**
 * 선택 계획과 GitHub blob 응답을 검증해 일회성 모델 근거로 조립한다.
 *
 * 응답 개수와 순서를 계획에 고정한다. 요청하지 않은 blob이 끼거나 하나가 빠지면
 * 부분 근거를 만들지 않는다. 반환값은 원문 저장소가 아니라 다음 단계에 바로
 * 넘길 메모리상의 텍스트 배열이다.
 */
export function assembleGithubEvidence(
  requests: GithubEvidenceBlobRequest[],
  responses: unknown[],
): GithubEvidenceAssemblyResult {
  if (!isValidPlan(requests)) {
    return { ok: false, code: 'invalid_plan', detail: 'GitHub 근거 조회 계획이 올바르지 않습니다.' }
  }
  if (responses.length !== requests.length) {
    return { ok: false, code: 'response_count', detail: 'GitHub 파일 응답 개수가 다릅니다.' }
  }

  const evidence: GithubEvidenceContent[] = []
  for (const [index, request] of requests.entries()) {
    const decoded = decodeGithubBlobResponse(
      { sha: request.sha, size: request.size },
      responses[index],
    )
    if (!decoded.ok) {
      return { ok: false, code: 'invalid_blob', detail: decoded.detail, index }
    }
    evidence.push({ path: request.path, content: decoded.content })
  }

  return { ok: true, evidence }
}
