/**
 * 코사인 유사도.
 *
 * 한 벌만 둔다. 전에는 `scripts/embed.ts`와 `relations/shortlist.ts`가
 * 각자 들고 있었고 **0으로 나누기 처리가 서로 달랐다**(`|| 1` vs 삼항).
 * 지금 입력에서는 결과가 같지만, 한쪽만 고치는 날 임베딩 스크립트와
 * 관계 판정이 다른 유사도를 쓰게 된다.
 *
 * 영벡터가 끼면 0을 준다 — "안 닮았다"로 취급되어 문턱에서 잘린다.
 */
export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const d = Math.sqrt(na) * Math.sqrt(nb)
  return d === 0 ? 0 : dot / d
}
