'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Grass } from '@/components/Grass'
import { grassWeeks, grassSummary, type Cell } from '@/lib/streak/grass'
import { loadStreak, todayKst } from '@/lib/streak/client'
import { distinctRead, streakLength, totalRead, emptyStreak } from '@/lib/streak/storage'
import { JOURNEY_STORAGE_KEY, deserializeJourney } from '@/lib/journey/storage'
import { suggestNext, type Candidate } from '@/lib/streak/suggest'

/**
 * 내가 판 자리.
 *
 * **계정이 없다.** 그래서 서버는 이 사람이 무엇을 봤는지 모르고, 이 화면의
 * 숫자는 전부 이 브라우저 안에서 나온다. 그 사실을 화면에도 적는다 --
 * 기기를 바꾸면 사라지는 기록을 계정처럼 보이게 두면 안 된다.
 *
 * 서버에서 그리지 않는다. 서버가 그린 것과 브라우저가 읽은 것이 다르면
 * 하이드레이션이 어긋난다. 붙은 뒤에 한 번 읽어 채운다.
 */
type View = {
  weeks: Array<Array<Cell | null>>
  summary: string
  total: number
  distinct: number
  streak: number
  next: Candidate[]
}

export function MePanel({ all }: { all: Candidate[] }) {
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    const streak = loadStreak()
    const today = todayKst()

    /* 무엇을 팠는지는 여정이 안다. 잔디는 언제 팠는지만 안다 */
    let readIds = new Set<string>()
    let readCategories: string[] = []
    try {
      const journey = deserializeJourney(window.localStorage.getItem(JOURNEY_STORAGE_KEY))
      if (journey) {
        readIds = new Set(journey.occurrences.map((o) => o.nodeId))
        readCategories = journey.occurrences.map((o) => o.category)
      }
    } catch {
      /* 못 읽으면 추천은 처음 온 사람과 같게 나간다 */
    }
    /* 잔디에만 있고 여정에서 밀려난 것도 읽은 것으로 친다 */
    for (const ids of Object.values(streak.days)) for (const id of ids) readIds.add(id)

    const weeks = grassWeeks(streak, today, 26)
    setView({
      weeks,
      summary: grassSummary(weeks),
      total: totalRead(streak),
      distinct: distinctRead(streak),
      streak: streakLength(streak, today),
      next: suggestNext(all, readIds, readCategories, 5),
    })
  }, [all])

  if (!view) {
    /* 첫 렌더. 자리를 잡아 둬야 값이 들어올 때 화면이 안 튄다 */
    const weeks = grassWeeks(emptyStreak(), todayKst(), 26)
    return (
      <div aria-busy="true">
        <Grass weeks={weeks} summary="기록을 읽는 중이다." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">판 자국</h2>
        <Grass weeks={view.weeks} summary={view.summary} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">숫자</h2>
        <dl className="grid grid-cols-3 gap-3">
          {[
            { k: '이어서 판 날', v: `${view.streak}일` },
            { k: '판 질문', v: `${view.distinct}개` },
            { k: '연 횟수', v: `${view.total}번` },
          ].map((it) => (
            <div key={it.k} className="rounded-lg border border-line bg-raised p-3">
              <dt className="text-sm text-muted">{it.k}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{it.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">다음에 팔 것</h2>
        <p className="mb-3 text-sm text-muted">
          판 적 없는 질문 가운데 고른다. 많이 판 분야를 먼저 주되 안 가 본 분야도 하나 섞는다.
        </p>
        {view.next.length === 0 ? (
          <p className="text-muted">권할 것이 없다. 있는 질문을 다 팠다.</p>
        ) : (
          <ul className="flex list-none flex-col gap-2 p-0">
            {view.next.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/q/${c.number}`}
                  className="block rounded-lg border border-line bg-raised p-3 no-underline"
                >
                  <span className="text-sm text-muted">{c.category}</span>
                  <span className="mt-1 block">{c.question}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted">
        이 기록은 <strong>이 브라우저에만</strong> 남는다. 서버로 보내지 않으므로 기기를 바꾸거나
        저장소를 지우면 사라진다. 계정이 붙으면 그때 합칠 수 있게 같은 모양으로 적어 두고 있다.
      </p>
    </div>
  )
}
