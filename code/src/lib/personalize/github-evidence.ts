import { containsSuspectedPii } from '@/lib/expand/validate'
import { redactGithubSecrets } from '@/lib/personalize/github-redaction'

export type GithubTreeEntry = {
  path: string
  type: 'blob' | 'tree'
  size?: number
  mode?: string
}

export type GithubEvidenceKind = 'overview' | 'architecture' | 'dependencies' | 'deployment'

export type GithubEvidenceFile = {
  path: string
  size: number
  kind: GithubEvidenceKind
}

export const MAX_GITHUB_EVIDENCE_FILES = 8
export const MAX_GITHUB_EVIDENCE_FILE_BYTES = 64_000
export const MAX_GITHUB_EVIDENCE_TOTAL_BYTES = 96_000

const DEPENDENCY_FILES = new Set([
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'composer.json',
  'gemfile',
  'mix.exs',
  'pubspec.yaml',
])

const DEPLOYMENT_FILES = new Set([
  'dockerfile',
  'compose.yaml',
  'compose.yml',
  'docker-compose.yaml',
  'docker-compose.yml',
  'vercel.json',
])

const ARCHITECTURE_NAMES = /^(architecture|design|engineering|system-design)(?:\.[^.]+)?\.md$/i
const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/i
const UNSAFE_SEGMENT =
  /(^|\/)(?:\.env(?:\.[^/]*)?|[^/]*(?:secret|credential|private[-_]?key)[^/]*)(?:\/|$)/i
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/

type Ranked = GithubEvidenceFile & { rank: number; depth: number }

/** 이후 URL 조립에서 레포 루트 밖으로 해석될 수 없는 상대 경로만 받는다. */
function isSafeRepoPath(path: string): boolean {
  if (!path || path.startsWith('/') || path.endsWith('/')) return false
  if (path.includes('\\') || CONTROL_CHARACTER.test(path)) return false
  if (containsSuspectedPii(path) || redactGithubSecrets(path) !== path) return false

  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

function classify(path: string): Omit<Ranked, 'path' | 'size'> | null {
  const lower = path.toLowerCase()
  const parts = lower.split('/')
  const name = parts.at(-1) ?? ''
  const depth = parts.length

  if (depth === 1 && /^readme(?:\.[^.]+)?$/i.test(name)) {
    return { kind: 'overview', rank: 0, depth }
  }

  if ((parts[0] === 'docs' || depth === 1) && ARCHITECTURE_NAMES.test(name)) {
    return { kind: 'architecture', rank: 1, depth }
  }

  // 모노레포의 앱별 선언도 보되 깊은 패키지 전부를 훑지는 않는다.
  if (depth <= 3 && DEPENDENCY_FILES.has(name)) {
    return { kind: 'dependencies', rank: 2, depth }
  }

  if (depth <= 2 && DEPLOYMENT_FILES.has(name)) {
    return { kind: 'deployment', rank: 3, depth }
  }

  if (WORKFLOW.test(lower)) {
    return { kind: 'deployment', rank: 4, depth }
  }

  return null
}

/**
 * 레포 전체 코드 대신 면접 질문의 근거가 되는 작은 파일 집합만 고른다.
 *
 * 소스 파일을 무차별로 모델에 보내면 비용과 프롬프트 인젝션 표면이 함께 커진다.
 * README, 설계 문서, 의존성 선언, 배포 설정만 허용하고 파일 수·개별 크기·전체
 * 바이트를 모두 제한한다. 파일 내용은 저장하지 않는 호출 경로에서만 사용한다.
 */
export function selectGithubEvidence(entries: GithubTreeEntry[]): GithubEvidenceFile[] {
  const seen = new Set<string>()
  const ranked: Ranked[] = []

  for (const entry of entries) {
    if (entry.type !== 'blob' || entry.mode === '120000') continue
    if (!Number.isSafeInteger(entry.size) || !entry.size || entry.size > MAX_GITHUB_EVIDENCE_FILE_BYTES) {
      continue
    }
    if (!isSafeRepoPath(entry.path) || UNSAFE_SEGMENT.test(entry.path)) continue

    const classified = classify(entry.path)
    if (!classified || seen.has(entry.path)) continue
    seen.add(entry.path)
    ranked.push({ path: entry.path, size: entry.size, ...classified })
  }

  ranked.sort(
    (a, b) => a.rank - b.rank || a.depth - b.depth || a.path.localeCompare(b.path, 'en'),
  )

  const selected: GithubEvidenceFile[] = []
  let bytes = 0
  for (const file of ranked) {
    if (selected.length >= MAX_GITHUB_EVIDENCE_FILES) break
    if (bytes + file.size > MAX_GITHUB_EVIDENCE_TOTAL_BYTES) continue
    selected.push({ path: file.path, size: file.size, kind: file.kind })
    bytes += file.size
  }

  return selected
}
