const REDACTED_SECRET = '[비밀정보 제거]'

const PRIVATE_KEY_BLOCK =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g
const CREDENTIAL_URL = /(\b[a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:)([^@\s/]+)(@)/gi
const ASSIGNED_SECRET =
  /(\b(?:api[_-]?key|access[_-]?key|access[_-]?token|auth[_-]?token|bearer|token|secret|password|passwd|client[_-]?secret)\b["']?\s*[:=]\s*)(["']?)([^\s"',;#}\]]+)(["']?)/gi
const KNOWN_TOKEN =
  /\b(?:gh[a-z]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|sk_live_[0-9A-Za-z]{16,}|xox[baprs]-[0-9A-Za-z-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g

/** 공개 레포에 실수로 커밋된 자격증명 후보를 모델 전송 전에 가린다. */
export function redactGithubSecrets(input: string): string {
  return input
    .replace(PRIVATE_KEY_BLOCK, REDACTED_SECRET)
    .replace(CREDENTIAL_URL, `$1${REDACTED_SECRET}$3`)
    .replace(
      ASSIGNED_SECRET,
      (_match, prefix: string, quote: string) => `${prefix}${quote}${REDACTED_SECRET}${quote}`,
    )
    .replace(KNOWN_TOKEN, REDACTED_SECRET)
}
