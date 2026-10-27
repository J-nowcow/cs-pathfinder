'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { StudyPractice } from './StudyPractice'
import { libraryButton } from './LibraryShell'
export type ExamQuestion = {
  id: string
  round: number
  session: number
  number: number
  text: string | null
  rawTopics: string[]
  types: string[]
  sourceUrl: string
  quality: string
  topics: string[]
}
export function ExamBrowser({
  questions,
  topicTitles,
}: {
  questions: ExamQuestion[]
  topicTitles: Record<string, string>
}) {
  const [search, setSearch] = useState(''),
    [round, setRound] = useState(''),
    [session, setSession] = useState(''),
    [kind, setKind] = useState(''),
    [coverage, setCoverage] = useState(''),
    [page, setPage] = useState(0)
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('exam')
    if (id && questions.some((q) => q.id === id)) {
      setSearch(id)
      setPage(0)
    }
  }, [questions])
  useEffect(() => {
    if (questions.some((q) => q.id === search)) {
      const el = document.getElementById(search)
      const detail = el?.querySelector('details[data-exam-note]')
      if (detail instanceof HTMLDetailsElement) detail.open = true
      el?.scrollIntoView({ block: 'start' })
    }
  }, [search, questions])
  const rounds = [...new Set(questions.map((q) => q.round))].sort(
    (a, b) => b - a,
  )
  const filtered = useMemo(
    () =>
      questions.filter(
        (q) =>
          (!round || q.round === Number(round)) &&
          (!session || q.session === Number(session)) &&
          (!kind || q.types.includes(kind)) &&
          (!coverage ||
            (coverage === 'unclassified'
              ? !q.topics.length
              : q.text !== null)) &&
          `${q.id} ${q.round} ${q.rawTopics.join(' ')} ${q.text ?? ''} ${q.topics.map((t) => topicTitles[t]).join(' ')}`
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
      ),
    [questions, search, round, session, kind, coverage, topicTitles],
  )
  const change = (fn: () => void) => {
    fn()
    setPage(0)
  }
  const label = (q: ExamQuestion) =>
    `${q.round}회 ${q.session}교시 ${q.number}번`
  return (
    <section id="questions" className="scroll-mt-6">
      <h2 className="text-2xl font-semibold">기출 위치 찾아보기</h2>
      <p className="mt-3 text-sm leading-7 text-muted">
        각 기록은 실제 기출의 위치입니다. 140회 31문항은 확인된 이용 조건에 따라
        원문을 제공하며, 이전 회차는 기술명 색인과 공식 원문 링크를 제공합니다.
        자동 주제·요구 유형은 배경 용어를 잡거나 놓칠 수 있어 원문 대조가
        필요합니다.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          기술명·회차 검색
          <input
            value={search}
            onChange={(e) => change(() => setSearch(e.target.value))}
            className="mt-2 w-full rounded-lg border border-line bg-surface p-3"
            placeholder="정규화, SLA, 140…"
          />
        </label>
        <label className="text-sm">
          회차
          <select
            className="mt-2 w-full rounded-lg border border-line bg-surface p-3"
            value={round}
            onChange={(e) => change(() => setRound(e.target.value))}
          >
            <option value="">수집한 전체 회차</option>
            {rounds.map((n) => (
              <option key={n} value={n}>
                {n}회
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          교시
          <select
            className="mt-2 w-full rounded-lg border border-line bg-surface p-3"
            value={session}
            onChange={(e) => change(() => setSession(e.target.value))}
          >
            <option value="">전체 교시</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}교시
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          요구 유형 · 자동 추정
          <select
            className="mt-2 w-full rounded-lg border border-line bg-surface p-3"
            value={kind}
            onChange={(e) => change(() => setKind(e.target.value))}
          >
            <option value="">전체 유형</option>
            {['개념', '비교', '계산', '설계', '적용', '절차', '평가'].map(
              (n) => (
                <option key={n}>{n}</option>
              ),
            )}
          </select>
        </label>
        <label className="text-sm">
          자료 범위
          <select
            className="mt-2 w-full rounded-lg border border-line bg-surface p-3"
            value={coverage}
            onChange={(e) => change(() => setCoverage(e.target.value))}
          >
            <option value="">전체 기록</option>
            <option value="fulltext">원문 제공</option>
            <option value="unclassified">학습 주제 연결 대기</option>
          </select>
        </label>
      </div>
      <p role="status" className="my-5 text-sm text-muted">
        {filtered.length.toLocaleString()}개 기록 ·{' '}
        {filtered.length
          ? `${page * 20 + 1}–${Math.min((page + 1) * 20, filtered.length)}`
          : '검색 결과 없음'}{' '}
        표시
      </p>
      <div className="space-y-4">
        {filtered.slice(page * 20, (page + 1) * 20).map((q) => (
          <article
            id={q.id}
            key={q.id}
            className="rounded-xl border border-line bg-surface p-5"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="font-semibold">{label(q)}</h3>
              <a
                className="text-sm text-accent underline underline-offset-4"
                href={q.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Q-Net 공식 문제지 ↗
              </a>
            </div>
            <p className="mt-3 text-sm leading-7 text-muted">
              기술명 색인:{' '}
              {q.rawTopics.length
                ? q.rawTopics.join(' · ')
                : '추출한 기술명 없음 · 원문 확인 필요'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {q.topics.map((t) => (
                <Link
                  className="rounded-full border border-line px-3 py-1 text-xs text-accent"
                  key={t}
                  href={'/learn/engineer/' + t}
                >
                  {topicTitles[t]}
                </Link>
              ))}
              {!q.topics.length && (
                <span className="text-xs text-faint">
                  선정한24개 학습 주제와 연결 대기
                </span>
              )}
            </div>
            <p className="mt-3 text-xs leading-6 text-faint">
              요구 유형 후보: {q.types.join(' · ') || '검토 대기'} ·{' '}
              {q.quality.includes('ocr')
                ? 'OCR 대조 필요'
                : q.quality.includes('legacy') ||
                    q.quality.includes('secondary')
                  ? '변환·복구 원문 대조 필요'
                  : '번호 확인 · 주제 분류는 미검토'}
            </p>
            {q.text ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-accent">
                  140회 기출 원문 보기
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                  {q.text}
                </p>
                <p className="mt-3 text-xs text-faint">
                  출처: 한국산업인력공단 Q-Net · 제140회 정보관리기술사 ·
                  공공누리 제1유형 및 AI유형 적용 안내 참조. 원문 구조·표는 공식
                  PDF와 대조하세요.
                </p>
              </details>
            ) : (
              <p className="mt-3 text-xs text-faint">
                이 기록은 원문 미수록 색인입니다. 공식 문제지에서 실제
                요구사항을 먼저 확인하세요.
              </p>
            )}
            <details data-exam-note className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-accent">
                이 기출의 내 답안 메모
              </summary>
              <div className="mt-4">
                <StudyPractice
                  id={'exam:' + q.id}
                  title={label(q)}
                  href={'/learn/engineer?exam=' + q.id + '#' + q.id}
                  track="engineer"
                  checklist={[
                    '공식 원문에서 실제 요구사항을 확인했다',
                    '개념·근거·적용 조건을 구분했다',
                    '답에서 빠진 부분을 표시했다',
                  ]}
                />
              </div>
            </details>
          </article>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className={libraryButton}
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          ← 이전20개
        </button>
        <button
          className={libraryButton}
          disabled={(page + 1) * 20 >= filtered.length}
          onClick={() => setPage(page + 1)}
        >
          다음20개 →
        </button>
        <button
          className={libraryButton}
          onClick={() => {
            setSearch('')
            setRound('')
            setSession('')
            setKind('')
            setCoverage('')
            setPage(0)
          }}
        >
          조건 초기화
        </button>
      </div>
    </section>
  )
}
