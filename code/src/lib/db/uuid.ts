import { createHash } from 'node:crypto'

/**
 * 시드에서 UUID를 파생한다.
 *
 * PGlite는 인메모리라 dev 서버를 재시작할 때마다 DB가 빈다. 매번 새 UUID가 나오면
 * 열어둔 읽기 뷰 URL이 전부 죽는다. 질문 텍스트에서 ID를 만들면 재시작 후에도
 * 같은 주소가 살아 있다.
 *
 * 무작위성이 목적이 아니라 재현성이 목적이므로 해시를 그대로 쓴다.
 * 다만 Postgres uuid 컬럼이 형식을 검사하므로 버전·변형 비트는 v4에 맞춘다.
 */
export function derivedUuid(seed: string): string {
  const h = createHash('sha256').update(seed, 'utf8').digest('hex')

  const version = `4${h.slice(13, 16)}`
  const variant = `${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}`

  return [h.slice(0, 8), h.slice(8, 12), version, variant, h.slice(20, 32)].join('-')
}
