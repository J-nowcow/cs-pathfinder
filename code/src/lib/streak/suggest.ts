/**
 * 다음에 팔 것을 고른다.
 *
 * 계정이 없으므로 서버는 이 사람이 무엇을 봤는지 모른다. 판단할 재료는
 * 브라우저에 있는 발자국뿐이다. 그래서 **고르는 일은 화면에서 한다.**
 *
 * 규칙은 셋이다.
 *
 * 1. 이미 판 것은 뺀다. 다시 권하면 추천이 아니라 잔소리다
 * 2. **많이 판 분야를 먼저 준다.** 관심이 이미 드러난 곳이다
 * 3. 다만 한 분야로만 채우지 않는다. 판 적 없는 분야도 하나는 섞는다 --
 *    그러지 않으면 처음 고른 분야에 영영 갇힌다
 *
 * 무작위를 안 쓴다. 새로고침마다 추천이 바뀌면 "아까 그거 뭐였지"가 안 된다.
 */
export type Candidate = { id: string; number: number; question: string; category: string }

export function suggestNext(
  all: Candidate[],
  readIds: Set<string>,
  readCategories: string[],
  limit = 5,
): Candidate[] {
  const unread = all.filter((c) => !readIds.has(c.id))
  if (unread.length === 0) return []

  /* 많이 판 분야 순서 */
  const weight = new Map<string, number>()
  for (const c of readCategories) weight.set(c, (weight.get(c) ?? 0) + 1)

  const seen = new Set(readCategories)
  const familiar = unread
    .filter((c) => seen.has(c.category))
    .sort((a, b) => (weight.get(b.category) ?? 0) - (weight.get(a.category) ?? 0) || a.number - b.number)
  const fresh = unread
    .filter((c) => !seen.has(c.category))
    .sort((a, b) => a.number - b.number)

  const out: Candidate[] = []
  /*
   * 판 적 없는 분야를 **먼저 한 자리 잡아 둔다.** 뒤에 붙이면 익숙한 분야가
   * 자리를 다 먹었을 때 밀려난다.
   */
  const opener = fresh.length > 0 && familiar.length > 0 ? [fresh[0]] : []
  for (const c of [...familiar, ...fresh]) {
    if (out.length + opener.length >= limit) break
    if (opener.includes(c)) continue
    out.push(c)
  }
  return [...out, ...opener].slice(0, limit)
}
