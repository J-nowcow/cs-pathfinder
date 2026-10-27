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
        '기록을 가져왔습니다. 중복 항목은 더 최근에 저장한 답안을 사용했습니다.',
      )
    } catch {
      setMessage(
        '파일을 가져오지 못했습니다. 이 화면에서 내보낸 JSON 파일인지, 3MB·200개 항목 한도를 넘지 않는지 확인하세요. 기존 기록은 바뀌지 않았습니다.',
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
                  <dt className="text-[15px] text-faint">{t}</dt>
                  <dd className="mt-1 text-3xl font-semibold">
                    {n}
                    <span className="ml-1 text-base font-normal text-muted">
                      개
                    </span>
                  </dd>
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
          복습 날짜가 오늘이거나 지난 항목입니다.
        </p>
        {view.due.length ? (
          <ul className="mt-5 space-y-3">
            {view.due.slice(0, 30).map((x) => (
              <li key={x.id}>
                <a
                  className="block rounded-lg border border-line p-4"
                  href={x.href}
                >
                  <span className="text-[15px] text-faint">
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
            복습할 항목이 없습니다. 수업이나 답안에서 ‘내일 다시 설명하기’를
            누르면 여기에 표시됩니다.
          </p>
        )}
      </section>
      <section>
        <h2 className="text-2xl font-semibold">최근 공부한 내용</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          최근에 저장한 기록부터 보여줍니다. 날짜가 없는 기록은 목록 끝에
          표시합니다.
        </p>
        <div className="mt-5 space-y-3">
          {view.recent.slice(0, 20).map((x) => (
            <a
              key={x.id}
              className="block rounded-lg border border-line p-4"
              href={x.href}
            >
              <span className="text-[15px] text-faint">
                {x.track} ·{' '}
                {x.at
                  ? new Date(x.at).toLocaleString('ko-KR', {
                      timeZone: 'Asia/Seoul',
                    })
                  : '날짜 없음'}
              </span>
              <p className="mt-1 font-medium text-accent">{x.title} →</p>
            </a>
          ))}
          {!view.recent.length && (
            <p className="rounded-xl border border-line p-5 text-sm text-muted">
              아직 학습 기록이 없습니다.
            </p>
          )}
        </div>
      </section>
      <details className="rounded-xl border border-line bg-raised p-6">
        <summary className="cursor-pointer text-xl font-semibold">
          답안 백업
        </summary>
        <p className="mt-3 text-sm leading-7 text-muted">
          기술사 답안과 Jira 과제의 메모·체크 항목·복습 날짜를 파일로
          저장합니다. 파일을 가져올 때는 항목별로 더 최근 기록을 사용합니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={libraryButton} onClick={backup}>
            기술사·Jira 과제 답안 저장
          </button>
          <label className={libraryButton + ' cursor-pointer'}>
            답안 파일 가져오기
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
            Jira 기본 수업 백업
          </a>
        </div>
        <p className="study-meta mt-5 text-muted">
          CS·PMP·Jira 기본 수업 기록은 각 화면에서 따로 백업할 수 있습니다. 복습
          날짜가 없는 Jira 기본 수업은 복습 목록에 표시되지 않습니다.
        </p>
        <p role="status" className="mt-4 text-sm text-muted">
          {message}
        </p>
      </details>
    </div>
  )
}
