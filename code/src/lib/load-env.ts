import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * .env.local을 읽어 process.env에 채운다.
 *
 * Next.js는 알아서 읽지만 스크립트와 테스트는 아니다.
 *
 * 값이 따옴표로 감싸여 있을 수 있다. Vercel CLI가 `KEY="value"` 형태로 쓴다.
 * 벗기지 않으면 접속 문자열 앞에 따옴표가 붙어 호스트명 파싱이 깨진다.
 * 이미 설정된 변수는 덮지 않는다. CI에서 주입한 값이 우선이다.
 */
export function loadEnvLocal(cwd: string = process.cwd()): void {
  const path = resolve(cwd, '.env.local')
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue

    const key = trimmed.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    if (process.env[key] !== undefined) continue

    process.env[key] = unquote(trimmed.slice(eq + 1).trim())
  }
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}
