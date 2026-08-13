'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Grass } from '@/components/Grass'
import { GrassShare } from '@/components/GrassShare'
import { grassWeeks, grassSummary, type Cell } from '@/lib/streak/grass'
import { loadStreak, todayKst } from '@/lib/streak/client'
import { distinctRead, streakLength, totalRead, emptyStreak } from '@/lib/streak/storage'
import { JOURNEY_STORAGE_KEY, deserializeJourney } from '@/lib/journey/storage'
import { JOURNEY_SYNCED_EVENT, STREAK_SYNCED_EVENT } from '@/lib/journey/sync'
import { suggestNext, type Candidate } from '@/lib/streak/suggest'
import { loadAnswerPractice } from '@/lib/answer-practice/storage'

/**
 * 내 기록.
 *
 * 숫자는 전부 이 브라우저의 localStorage에서 나온다. 로그인하면
 * SyncAgent가 계정 기록을 여기로 합치고(C4) 이벤트로 알린다 — 그때
 * 다시 읽어 그린다. 로그인 직후 잔디가 즉시 합산으로 바뀌는 이유다.
 *
 * 서버에서 그리지 않는다. 서버가 그린 것과 브라우저가 읽은 것이 다르면
 * 하이드레이션이 어긋난다. 붙은 뒤에 한 번 읽어 채운다.
 */
type View = {
  weeks: Array<Array<Cell | null>>
  summary: string
  total: number
  distinct: number
  answered: number
  streak: number
  next: Candidate[]
}

export function MePanel({ all }: { all: Candidate[] }) {
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    const compute = () => {
      const streak = loadStreak()
      const answerPractice = loadAnswerPractice()
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
        answered: Object.keys(answerPractice.drafts).length,
        streak: streakLength(streak, today),
        next: suggestNext(all, readIds, readCategories, 5),
      })
    }

    compute()
    /* 로그인 동기화가 localStorage를 바꿨다 — 합산된 기록으로 다시 그린다 */
    window.addEventListener(JOURNEY_SYNCED_EVENT, compute)
    window.addEventListener(STREAK_SYNCED_EVENT, compute)
    return () => {
      window.removeEventListener(JOURNEY_SYNCED_EVENT, compute)
      window.removeEventListener(STREAK_SYNCED_EVENT, compute)
    }
  }, [all])

  if (!view) {
    /* 첫 렌더. 자리를 잡아 둬야 값이 들어올 때 화면이 안 튄다 */
    const weeks = grassWeeks(emptyStreak(), todayKst(), 26)
    return (
      <div aria-busy="true">
        <p role="status" className="mb-3 flex items-center gap-2 text-[13px] text-faint">
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-faint/30 border-t-faint"
          />
          학습 기록을 불러오는 중
        </p>
        <Grass weeks={weeks} summary="기록을 읽는 중입니다." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">학습 기록</h2>
        {view.total === 0 && (
          <div className="mb-4 flex items-center gap-4 rounded-lg border border-line bg-raised p-4">
            {/* 문구가 전부를 말한다 — 두더지는 장식이라 낭독기에서 뺀다 */}
            <Image
              src="/mascot/mole-digging.png"
              alt=""
              aria-hidden
              width={88}
              height={88}
              className="shrink-0 select-none"
            />
            <p className="text-[15px] leading-[1.7] text-muted">
              아직 열어 본 질문이 없습니다. 질문을 열어 본 날이 여기 잔디에 남습니다.{' '}
              <Link href="/" className="rounded-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                오늘의 질문 보기
              </Link>
            </p>
          </div>
        )}
        <Grass weeks={view.weeks} summary={view.summary} />
        <GrassShare
          weeks={view.weeks}
          stats={{ total: view.total, distinct: view.distinct, streak: view.streak }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">숫자</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: '연속 방문일', v: `${view.streak}일` },
            { k: '열어 본 질문', v: `${view.distinct}개` },
            { k: '답변해 본 질문', v: `${view.answered}개` },
            { k: '열어 본 횟수', v: `${view.total}번` },
          ].map((it) => (
            <div key={it.k} className="rounded-lg border border-line bg-raised p-3">
              <dt className="text-sm text-muted">{it.k}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{it.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">다음 추천 질문</h2>
        <p className="mb-3 text-sm text-muted">
          아직 읽지 않은 질문 가운데 고릅니다. 자주 열어 본 분야를 앞세우되 안 가 본 분야도 하나 섞습니다.
        </p>
        {view.next.length === 0 ? (
          <p className="text-muted">권할 것이 없습니다. 있는 질문을 모두 읽으셨습니다.</p>
        ) : (
          <ul className="flex list-none flex-col gap-2 p-0">
            {view.next.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/q/${c.number}`}
                  className="block rounded-lg border border-line bg-raised p-3 no-underline transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
        로그인하지 않으면 이 기록은 <strong>이 브라우저에만</strong> 남습니다 — 기기를 바꾸거나
        저장소를 지우면 사라집니다. 로그인하면 계정에 저장되어 다른 기기에서 로그인해도 이어집니다.
      </p>
    </div>
  )
}
