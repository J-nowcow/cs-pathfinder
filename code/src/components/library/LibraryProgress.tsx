'use client'
import { useEffect, useRef, useState } from 'react'
import { OpenBookArt } from './BookArt'
import pmpTitles from '../../../data/pmp-library.json'
import { readLibraryProgress, type ProgressItem } from '@/lib/library/progress'
import { LIBRARY_EVENT } from '@/lib/library/storage'
import {
  readLibraryStrict,
  restoreLibraryStrict,
  LibraryEditError,
} from '@/lib/library/local-edit'
import { libraryAccountStateSchema } from '@/lib/library/account-schema'
import { PmpBackup } from '@/components/pmp/PmpBackup'
import { libraryButton } from './LibraryShell'
import { JOURNEY_SYNCED_EVENT, STREAK_SYNCED_EVENT } from '@/lib/journey/sync'
import { LibraryAccountPanel, useLibraryScope } from './LibraryAccount'
export function LibraryProgress({
  questionTitles = {},
  mode = 'progress',
}: {
  questionTitles?: Record<string, string>
  mode?: 'progress' | 'shelf'
}) {
  const scope = useLibraryScope()
  const restoreSerial = useRef(0),
    latestScope = useRef(scope)
  latestScope.current = scope
  useEffect(
    () => () => { restoreSerial.current++ },
    [scope.id, scope.ready],
  )
  const [view, setView] = useState<ReturnType<
      typeof readLibraryProgress
    > | null>(null),
    [message, setMessage] = useState('')
  useEffect(() => {
    if (!scope.ready) { setView(null); return }
    const refresh = () =>
      setView(
        readLibraryProgress({
          getItem: (key) => (scope.storage ?? window.localStorage).getItem(key),
        }),
      )
    refresh()
    const events = [
      'storage',
      'focus',
      'pageshow',
      'pathfinder-pmp-updated',
      'pathfinder-certificate-updated',
      LIBRARY_EVENT,
      JOURNEY_SYNCED_EVENT,
      STREAK_SYNCED_EVENT,
    ]
    events.forEach((e) => window.addEventListener(e, refresh))
    return () => events.forEach((e) => window.removeEventListener(e, refresh))
  }, [scope.storage, scope.ready])
  function backup() {
    let state
    try {
      state = readLibraryStrict(scope.storage ?? localStorage)
    } catch {
      setMessage(
        '저장된 기록을 온전히 읽지 못해 백업을 만들지 않았어요. 브라우저의 기존 기록은 그대로예요.',
      )
      return
    }
    const blob = new Blob(
      [
        JSON.stringify(
          { format: 'pathfinder.library.backup', ...state },
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
    const token = ++restoreSerial.current,
      selectedScope = scope.id
    const isCurrent = () =>
      token === restoreSerial.current && latestScope.current.ready &&
      latestScope.current.id === selectedScope
    if (!file || !scope.ready) return
    try {
      if (file.size > 3000000) throw Error()
      const raw = await file.text()
      if (!isCurrent()) return
      const input = JSON.parse(raw)
      if (
        input.format !== 'pathfinder.library.backup' ||
        !input.entries ||
        typeof input.entries !== 'object' ||
        Array.isArray(input.entries)
      )
        throw Error()
      if (
        Object.keys(input).some(
          (key) => !['format', 'version', 'entries'].includes(key),
        )
      )
        throw Error()
      const clean = libraryAccountStateSchema.parse({
        version: input.version,
        entries: input.entries,
      })
      restoreLibraryStrict(scope.storage ?? localStorage, clean)
      window.dispatchEvent(new Event(LIBRARY_EVENT))
      setMessage(
        '기록을 가져왔어요. 비어 있지 않은 답안은 보존했고 답안이 같은 항목의 체크·복습 날짜는 더 최근 기록을 사용했어요.',
      )
    } catch (error) {
      if (!isCurrent()) return
      setMessage(
        error instanceof LibraryEditError && error.code === 'conflict'
          ? '서로 다른 답안이 겹치거나 200개 한도를 넘어서 가져오지 않았어요. 기존 기록과 백업 파일은 그대로예요.'
          : '파일을 가져오지 못했어요. 파일 형식과 3MB·200개 한도, 브라우저 기록과 저장 설정을 확인해 주세요. 기존 기록은 바뀌지 않았어요.',
      )
    }
  }
  const displayTitle = (item: ProgressItem) =>
    item.id.startsWith('exam:')
      ? (questionTitles[item.id.slice(5)] ?? item.title)
      : item.title
  const when = (value: string | null) =>
    value
      ? new Date(value).toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '날짜 없음'
  const rows = (items: ProgressItem[], review = false) => (
    <ul className="desk-item-list">
      {items.map((x) => (
        <li key={x.id}>
          <a href={x.href}>
            <span className="desk-row-meta">
              {x.track}
              {x.id.startsWith('exam:') && displayTitle(x) !== x.title
                ? ' · ' + x.title
                : ''}
            </span>
            <span className="desk-row-title">{displayTitle(x)}</span>
            <span className="desk-row-end">
              {review ? x.due : when(x.at)} <span aria-hidden="true">↗</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
  if (!view)
    return (
      <>
        <p role="status">학습 기록을 불러오는 중…</p>
        <noscript><p>내 서재의 기록을 보려면 JavaScript가 필요합니다. <a href="/learn">학습 자료 둘러보기 →</a></p></noscript>
      </>
    )
  const latest = view.recent[0]
  const previous = view.recent.slice(1)
  const focus = latest ? (
    <section className="desk-focus" aria-label="이어서 공부할 내용">
      <OpenBookArt />
      <p className="desk-kicker">마지막으로 공부한 내용</p>
      <p className="desk-focus-meta">
        {latest.track}
        {latest.id.startsWith('exam:') && displayTitle(latest) !== latest.title
          ? ' · ' + latest.title
          : ''}{' '}
        · {when(latest.at)}
      </p>
      <h2
        className={
          'desk-resume-title' +
          (displayTitle(latest).length > 70 ? ' is-long' : '')
        }
      >
        {displayTitle(latest)}
      </h2>
      {latest.excerpt && (
        <blockquote className="desk-draft-preview">
          <span>작성 중인 내 답안</span>
          <p>{latest.excerpt}</p>
        </blockquote>
      )}
      <a href={latest.href} className="desk-primary">
        이어서 읽기 <span aria-hidden="true">→</span>
      </a>
    </section>
  ) : (
    <section className="desk-focus desk-start" aria-label="공부 시작하기">
      <p className="desk-kicker">처음 방문했나요?</p>
      <h2 className="desk-resume-title">공부할 자료를 고르세요.</h2>
      <p className="desk-start-note">
        자료를 읽거나 답안을 쓰면 다음에 여기서 이어볼 수 있습니다.
      </p>
      <ul className="desk-start-list">
        <li>
          <a href="/questions">
            <span>CS 면접</span>
            <strong>면접 질문과 해설</strong>
            <span aria-hidden="true">→</span>
          </a>
        </li>
        <li>
          <a href="/learn/pmp/n01">
            <span>PMP</span>
            <strong>{pmpTitles.nodes.find((n) => n.id === 'n01')!.title}</strong>
            <span aria-hidden="true">→</span>
          </a>
        </li>
        <li>
          <a href="/learn/jira">
            <span>Jira</span>
            <strong>기본 수업부터 읽기</strong>
            <span aria-hidden="true">→</span>
          </a>
        </li>
        <li>
          <a href="/learn/engineer/normalization">
            <span>정보관리기술사</span>
            <strong>정규화와 역정규화</strong>
            <span aria-hidden="true">→</span>
          </a>
        </li>
      </ul>
    </section>
  )
  if (mode === 'shelf')
    return (
      <div>
        {view.unavailable && (
          <p role="alert" className="desk-storage-alert">
            일부 기록을 읽지 못했어요. 브라우저 저장 설정을 확인하세요.
          </p>
        )}
        {latest ? focus : (
          <section className="desk-shelf-empty" aria-labelledby="shelf-empty-heading">
            <OpenBookArt />
            <h2 id="shelf-empty-heading">아직 읽은 자료가 없어요.</h2>
            <p>자료를 읽거나 답안을 쓰면 이곳에서 이어 볼 수 있습니다.</p>
            <a href="/learn" className="desk-primary">공부 자료 둘러보기 →</a>
          </section>
        )}
        {view.due.length > 0 && (
          <a
            className="desk-review-shortcut"
            href="/learn/progress#desk-review-heading"
          >
            복습할 내용 {view.due.length}개 →
          </a>
        )}
        {!!previous.length && (
          <section className="desk-section" aria-labelledby="shelf-recent-heading">
            <div className="desk-section-heading"><h2 id="shelf-recent-heading">이전에 읽은 자료</h2></div>
            {rows(previous.slice(0, 5))}
          </section>
        )}
        <div className="desk-shelf-actions">
          <a href="/learn/progress">복습·백업 열기 →</a>
          <a href="/learn">다른 공부 자료 찾기 →</a>
        </div>
      </div>
    )

  return (
    <div>
      {view.unavailable && (
        <p role="alert" className="desk-storage-alert">
          일부 기록을 읽지 못했어요. 브라우저 저장 설정과 학습 자료의 백업을
          확인하세요.
        </p>
      )}
      {focus}
      <section className="desk-section" aria-labelledby="desk-review-heading">
        <div className="desk-section-heading">
          <h2 id="desk-review-heading">복습할 내용</h2>
          <span>{view.due.length}개</span>
        </div>
        {view.due.length ? (
          <>
            {rows(view.due.slice(0, 5), true)}
            {view.due.length > 5 && (
              <details className="desk-more">
                <summary>나머지 {view.due.length - 5}개 보기</summary>
                {rows(view.due.slice(5), true)}
              </details>
            )}
          </>
        ) : (
          <p className="desk-empty">예정된 복습이 없습니다.</p>
        )}
      </section>
      {!!previous.length && (
        <section className="desk-section" aria-labelledby="desk-recent-heading">
          <div className="desk-section-heading">
            <h2 id="desk-recent-heading">이전에 공부한 내용</h2>
          </div>
          {rows(previous.slice(0, 5))}
          {previous.length > 5 && (
            <details className="desk-more">
              <summary>이전 기록 {previous.length - 5}개 더 보기</summary>
              {rows(previous.slice(5))}
            </details>
          )}
        </section>
      )}
      <div className="desk-tools">
        <LibraryAccountPanel />
        <PmpBackup />
        <details className="desk-utility">
          <summary>분야별 학습 기록</summary>
          <dl className="desk-track-stats">
            {view.cards.map((c) => (
              <div key={c.id}>
                <dt>
                  <a href={c.href}>{c.title} →</a>
                </dt>
                <dd>
                  {c.metrics.map(([t, n]) => (
                    <span key={t}>
                      {t} <b>{n}</b>개
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </details>
        <details className="desk-utility">
          <summary className="cursor-pointer font-semibold">답안 백업</summary>
          <p className="mt-3 text-sm leading-7 text-muted">
            기술사 답안과 Jira 과제의 메모·체크 항목·복습 날짜를 파일로
            저장합니다. 서로 다른 답안이 겹치면 가져오기를 멈추고 기존 기록을
            보존합니다.
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
            <a
              className={libraryButton}
              href="/learn/certificate#certificate-backup"
            >
              정처기 이론 기록·백업
            </a>
            <a className={libraryButton} href="/me">
              CS 내 기록
            </a>
            <a className={libraryButton} href="#pmp-backup">
              PMP 내 기록·백업
            </a>
            <a className={libraryButton} href="/jira/index.html#home">
              Jira 기본 수업 백업
            </a>
          </div>
          <p className="study-meta mt-5 text-muted">
            CS·PMP·Jira 기본 수업 기록은 각 화면에서 따로 백업할 수 있습니다.
            복습 날짜가 없는 Jira 기본 수업은 복습 목록에 표시되지 않습니다.
          </p>
          <p role="status" className="mt-4 text-sm text-muted">
            {message}
          </p>
        </details>
      </div>
    </div>
  )
}
