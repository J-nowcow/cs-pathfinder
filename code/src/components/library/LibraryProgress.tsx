'use client'
import { useEffect, useState } from 'react'
import { readLibraryProgress } from '@/lib/library/progress'
import {
  loadLibrary,
  parseLibrary,
  mergeLibrary,
  saveLibrary,
  LIBRARY_EVENT,
} from '@/lib/library/storage'
import release from '../../../data/pmp-release.json'
import { libraryButton } from './LibraryShell'
import { JOURNEY_SYNCED_EVENT, STREAK_SYNCED_EVENT } from '@/lib/journey/sync'
export function LibraryProgress() {
  const [view, setView] = useState<ReturnType<
      typeof readLibraryProgress
    > | null>(null),
    [message, setMessage] = useState('')
  useEffect(() => {
    const refresh = () =>
      setView(
        readLibraryProgress({
          getItem: (key) => window.localStorage.getItem(key),
        }),
      )
    refresh()
    const events = [
      'storage',
      'focus',
      'pageshow',
      LIBRARY_EVENT,
      JOURNEY_SYNCED_EVENT,
      STREAK_SYNCED_EVENT,
    ]
    events.forEach((e) => window.addEventListener(e, refresh))
    return () => events.forEach((e) => window.removeEventListener(e, refresh))
  }, [])
  function backup() {
    const blob = new Blob(
      [
        JSON.stringify(
          { format: 'pathfinder.library.backup', ...loadLibrary() },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const u = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = u
    a.download = 'pathfinder-기술사-실습-기록.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(u), 1000)
  }
  async function restore(file: File | undefined) {
    if (!file) return
    try {
      if (file.size > 3000000) throw Error()
      const raw = await file.text(),
        input = JSON.parse(raw)
      if (
        input.format !== 'pathfinder.library.backup' ||
        !input.entries ||
        typeof input.entries !== 'object' ||
        Array.isArray(input.entries)
      )
        throw Error()
      const clean = parseLibrary(raw)
      if (
        input.version !== 1 ||
        Object.keys(clean.entries).length !== Object.keys(input.entries).length
      )
        throw Error()
      const merged = mergeLibrary(loadLibrary(), clean)
      if (!merged) throw Error()
      if (!saveLibrary(merged)) throw Error()
      setMessage(
        '더 최근 기록을 우선해 기술사·실무 미션 기록을 합쳤어요. 기존 CS·PMP·Jira 공부방 기록은 그대로입니다.',
      )
    } catch {
      setMessage(
        '가져오지 못했어요. 이 화면에서 내보낸3MB 이하의 올바른 파일과200개 기록 한도를 확인해 주세요. 기존 기록은 보존했어요.',
      )
    }
  }
  if (!view) return <p role="status">이 브라우저의 학습 기록을 불러오는 중…</p>
  return (
    <div className="space-y-10">
      {view.unavailable && (
        <p role="alert" className="rounded-lg border border-line p-4">
          일부 기록을 읽지 못했어요. 브라우저 저장 허용 여부와 원래 학습 화면의
          백업을 확인해 주세요.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {view.cards.map((c) => (
          <section
            key={c.id}
            className="rounded-xl border border-line bg-surface p-6"
          >
            <h2 className="text-xl font-semibold">{c.title}</h2>
            <dl className="mt-5 flex flex-wrap gap-8">
              {c.metrics.map(([t, n]) => (
                <div key={t}>
                  <dt className="text-xs text-faint">{t}</dt>
                  <dd className="mt-1 text-3xl font-semibold">{n}</dd>
                </div>
              ))}
            </dl>
            <a className={libraryButton + ' mt-5'} href={c.href}>
              {c.resume} →
            </a>
          </section>
        ))}
      </div>
      <section>
        <h2 className="text-2xl font-semibold">
          오늘까지 복습할 것{' '}
          <span className="text-faint">{view.due.length}</span>
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          CS·PMP의 기존 복습 날짜와 기술사·미션의 자기 점검 날짜를 함께
          읽습니다. Jira 공부방 수업은 완료 표시이며 별도 복습 날짜가 없어
          여기서 임의 생성하지 않습니다.
        </p>
        {view.due.length ? (
          <ul className="mt-5 space-y-3">
            {view.due.slice(0, 30).map((x) => (
              <li key={x.id}>
                <a
                  className="block rounded-lg border border-line p-4"
                  href={x.href}
                >
                  <span className="text-xs text-faint">
                    {x.track} · {x.due}
                  </span>
                  <b className="mt-1 block font-medium text-accent">
                    {x.title} →
                  </b>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 rounded-xl border border-line p-5 text-sm text-muted">
            기록된 복습 대기가 없어요. 주제를 읽고 ‘내일 다시 설명하기’로 복습을
            예약해 보세요.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-2xl font-semibold">최근 기록·이어보기</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          시각이 있는 활동은 최신순입니다. 예전 CS 방문 경로처럼 시각을 남기지
          않은 기록은 뒤에 따로 표시합니다. 읽기·완료·정답의 단위가 달라 전체
          숙련도 비율로 합산하지 않습니다.
        </p>
        <div className="mt-5 space-y-3">
          {view.recent.slice(0, 20).map((x) => (
            <a
              key={x.id}
              className="block rounded-lg border border-line p-4"
              href={x.href}
            >
              <span className="text-xs text-faint">
                {x.track} ·{' '}
                {x.at
                  ? new Date(x.at).toLocaleString('ko-KR', {
                      timeZone: 'Asia/Seoul',
                    })
                  : '시각 미기록 · 이어보기'}
              </span>
              <p className="mt-1 font-medium text-accent">{x.title} →</p>
            </a>
          ))}
          {!view.recent.length && (
            <p className="rounded-xl border border-line p-5 text-sm text-muted">
              아직 이 브라우저의 기록이 없어요. 학습 분야에서 시작하면 이어볼
              위치가 여기에 모여요.
            </p>
          )}
        </div>
      </section>
      <section className="rounded-xl border border-line bg-raised p-6">
        <h2 className="text-xl font-semibold">기술사·실무 미션 기록 백업</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          이곳에서 새로 쓰는 기술사·미션의 답안·체크·복습 날짜를 내보내고
          합칩니다. 같은 항목은 더 최근 기록을 사용합니다. CS 계정 기록이나
          PMP·Jira 공부방의 원래 백업을 이 파일로 덮어쓰지 않습니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={libraryButton} onClick={backup}>
            기술사·미션 기록 내보내기
          </button>
          <label className={libraryButton + ' cursor-pointer'}>
            기록 파일 가져오기
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                void restore(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          <a className={libraryButton} href="/me">
            CS 내 기록
          </a>
          <a className={libraryButton} href={release.links.study + '#record'}>
            PMP 내 기록·백업
          </a>
          <a className={libraryButton} href="/jira/index.html#home">
            Jira 공부방 백업
          </a>
        </div>
        <p role="status" className="mt-4 text-sm text-muted">
          {message}
        </p>
      </section>
    </div>
  )
}
