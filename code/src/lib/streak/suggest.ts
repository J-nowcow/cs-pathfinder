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
 * 3. **분야를 돌아가며 하나씩 뽑는다.** 한 분야를 몰아 주면 처음 고른 곳에
 *    영영 갇힌다. 처음 온 사람에게는 특히 나쁘다 -- 번호순으로 채우면 다섯 중
 *    넷이 같은 분야로 나온다. 실제로 그랬다
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

  const weight = new Map<string, number>()
  for (const c of readCategories) weight.set(c, (weight.get(c) ?? 0) + 1)

  /* 분야별로 모으고 각 분야 안에서는 번호가 작은 것부터 */
  const byCategory = new Map<string, Candidate[]>()
  for (const c of unread) byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c])
  for (const list of byCategory.values()) list.sort((a, b) => a.number - b.number)

  /*
   * 많이 판 분야가 앞이다. 안 판 분야끼리는 **번호가 작은 질문을 가진 쪽**을
   * 앞에 둔다 -- 이름순으로 두면 매번 같은 분야가 첫 자리를 먹는다.
   */
  const order = [...byCategory.keys()].sort(
    (a, b) =>
      (weight.get(b) ?? 0) - (weight.get(a) ?? 0) ||
      byCategory.get(a)![0].number - byCategory.get(b)![0].number,
  )

  const out: Candidate[] = []
  for (let round = 0; out.length < limit; round += 1) {
    let added = false
    for (const category of order) {
      const list = byCategory.get(category)!
      if (round >= list.length) continue
      out.push(list[round])
      added = true
      if (out.length >= limit) break
    }
    /* 모든 분야가 바닥나면 멈춘다. 없으면 영영 돈다 */
    if (!added) break
  }
  return out
}
