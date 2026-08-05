import { randomBytes } from 'node:crypto'

/**
 * 공유 트리의 주소.
 *
 * **제목에서 만들지 않는다.** 질문이 한글이라 slugify하면 퍼센트 인코딩 덩어리가 되고,
 * 그 상태로 카톡에 붙으면 주소가 화면 두 줄을 먹는다. 로마자 변환은 원문을 잃는다.
 *
 * **순번도 쓰지 않는다.** /t/1 다음이 /t/2면 남의 트리를 순서대로 열어볼 수 있다.
 * 인증이 없어서 트리에 소유자 표시가 없을 뿐이지, 공유 링크를 받은 사람만 보는 게
 * 전제다. 열거 가능한 주소는 그 전제를 깬다.
 *
 * 그래서 짧은 무작위 토큰이다. 길이 12에 알파벳 30자면 경우의 수가 30^12 ≈ 2^59다.
 * 무작위로 찍어서 맞히는 건 사실상 불가능하고, 생일 문제로 봐도 충돌이 절반 확률에
 * 닿으려면 트리가 7억 개쯤 필요하다. 반대로 12자는 도메인 뒤에 붙어도 한 줄을 안 넘는다.
 *
 * 알파벳에서 0·o·1·l·i를 뺐다. 링크를 눈으로 옮겨 적는 사람이 반드시 나온다.
 */
export const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const SLUG_LENGTH = 12

const SLUG_RE = new RegExp(`^[${SLUG_ALPHABET}]{${SLUG_LENGTH}}$`)

/**
 * 모듈로 편향을 버린다.
 *
 * `byte % 31`을 그대로 쓰면 0~9 구간이 다른 글자보다 자주 나온다(256 = 31*8 + 8).
 * 보안 토큰에서 앞 글자가 더 자주 나오는 건 그만큼 탐색 공간이 줄었다는 뜻이라
 * 남는 바이트는 버리고 다시 뽑는다.
 */
export function newSlug(): string {
  const n = SLUG_ALPHABET.length
  const ceiling = Math.floor(256 / n) * n

  let out = ''
  while (out.length < SLUG_LENGTH) {
    for (const b of randomBytes(SLUG_LENGTH)) {
      if (b >= ceiling) continue
      out += SLUG_ALPHABET[b % n]
      if (out.length === SLUG_LENGTH) break
    }
  }

  return out
}

/**
 * 주소에서 받은 값을 DB에 던지기 전에 거른다.
 *
 * 형식이 틀린 건 존재할 수 없는 slug라 조회 자체가 낭비다. 봇이 주소를 훑을 때
 * DB까지 가지 않게 막는다.
 */
export function isValidSlug(value: string): boolean {
  return SLUG_RE.test(value)
}
