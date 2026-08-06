import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { reserveQuota, commitQuota, releaseQuota } from '@/lib/quota'

/**
 * 반납과 확정을 겹쳐 부르면 한도가 샌다.
 *
 * `quota_commit`이 `reserved = greatest(reserved - 1, 0)`이다. 자기 예약을 이미
 * 반납한 뒤에 확정하면 그 감산이 **옆 요청의 예약**을 대신 깎는다.
 *
 * 처음에는 이걸 못 재고 넘어갔다. `reserved + used` 합계를 봤는데 그 값이
 * 하필 자가 보정된다 — `greatest(…, 0)`가 음수를 눌러서 다 돌고 나면
 * 앞뒤가 맞아떨어진다. 세 번 돌려도 같은 값이 나왔다.
 *
 * 피해는 합계가 아니라 **중간 상태**에 있다. `quota_reserve`는
 * `used + reserved >= limit`으로 판정하는데, 잘못된 반납이 그 합을 잠깐 낮춰
 * 그 창으로 한 건이 더 들어온다. 그래서 재야 할 것은 "예약 수가 남았는가"가
 * 아니라 **"한도를 넘은 요청이 거부되는가"**였다.
 *
 * 동시성이 필요 없다. 순차 호출만으로 난다.
 */
const KEY = 'anon:quota-leak'
const LIMIT = 2

describe('반납 뒤 확정', () => {
  beforeEach(truncateAll)

  /* 정상 흐름에서는 한도가 지켜진다. 대조군이다 */
  it('refuses past the limit when nobody double-releases', async () => {
    expect(await reserveQuota(KEY, LIMIT)).toBe(true)
    expect(await reserveQuota(KEY, LIMIT)).toBe(true)
    await commitQuota(KEY)
    expect(await reserveQuota(KEY, LIMIT), '한도를 넘었는데 통과했다').toBe(false)
  })

  /*
   * 반납하고 확정하면 한 건이 더 새어 들어온다. **이건 고쳐진 것이 아니라
   * 위험이 있다는 기록이다.**
   *
   * `quota_commit`은 자기 예약이 아직 있는지 모른다. 그래서 반납 뒤에 부르면
   * 옆 요청의 예약을 대신 깎고, 그만큼 한도가 열린다.
   *
   * **못 고치는 것은 아니다.** 원래 여기 "지금 스키마로는 방법이 없다"고 적었는데
   * 틀렸다. 원인은 식별 불가가 아니라 `quota_commit`이 두 일을 겸하는 것이다 —
   * 예약 반납과 사용 계상. 감산을 빼고 `used = used + 1`만 남기면 같은 스키마로
   * 누수가 사라진다. 재봤다.
   *
   *   A예약 true · B예약 true · A가 잘못 반납 · A확정(감산 없음)
   *   → used 1 · reserved 1 → C예약 **false**
   *
   * 안 하는 이유는 대가가 호출 쪽에 있어서다. 모든 예약이 정확히 한 번 반납돼야
   * 하고, 그러려면 `expand`의 출구 여덟 개를 `try/finally`로 감싸야 한다. 그
   * 구간은 어차피 손봐야 하는 자리(try 없는 6연속 await)라 같이 하는 편이 낫고,
   * 그래서 지금은 안 한다.
   *
   * **이 시험은 기록이지 방어가 아니다.** SQL이 샌다는 사실을 고정할 뿐,
   * 누가 `release → commit` 조합을 다시 넣는 것은 못 막는다. 진짜 방어선은
   * `expand`의 출구마다 예약이 정확히 한 번 정산되는지 보는 시험이고 그것은
   * 아직 없다. `stale-lease.test.ts`가 `ok` 경로 하나만 잡고 있다.
   */
  it('leaks one past the limit when a release is followed by a commit', async () => {
    await reserveQuota(KEY, LIMIT) // A
    await reserveQuota(KEY, LIMIT) // B — 여기서 한도가 찼다

    await releaseQuota(KEY) // A가 잘못 반납한다
    await commitQuota(KEY) // 그런데 A가 생성을 끝내고 확정한다

    // 합계(reserved + used)로는 티가 안 난다. greatest(…,0)가 스스로 보정한다.
    // 통과 여부로 봐야 보인다
    expect(await reserveQuota(KEY, LIMIT), '누수가 사라졌다면 이 시험을 뒤집어라').toBe(true)
  })
})
