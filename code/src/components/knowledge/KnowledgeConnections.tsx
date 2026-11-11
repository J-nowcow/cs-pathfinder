'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { siteUrl } from '@/lib/site'
import type { MapData } from '@/lib/db/graph'
import type { GraphNeighbor } from '@/lib/graph/relations'
import {
  deriveKnowledgeContext,
  emptyKnowledgeRecords,
  formatKnowledgeMarkdown,
  readKnowledgeRecords,
  type KnowledgeConnection,
  type KnowledgeRecords,
} from '@/lib/graph/learning-context'
import { JOURNEY_STORAGE_KEY } from '@/lib/journey/storage'
import { STREAK_STORAGE_KEY } from '@/lib/streak/storage'
import { JOURNEY_SYNCED_EVENT, STREAK_SYNCED_EVENT } from '@/lib/journey/sync'
import {
  ANSWER_PRACTICE_STORAGE_KEY,
  LEGACY_ANSWER_PRACTICE_STORAGE_KEY,
} from '@/lib/answer-practice/storage'

const STORAGE_KEYS = new Set([
  JOURNEY_STORAGE_KEY, STREAK_STORAGE_KEY,
  ANSWER_PRACTICE_STORAGE_KEY, LEGACY_ANSWER_PRACTICE_STORAGE_KEY,
])
const QUESTION_BUTTON = 'rounded-sm text-left font-medium text-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function nextRelationLabel(relation: GraphNeighbor): string {
  if (relation.kind === 'walked' && !relation.relationKind) return '질문 이동으로 이어진 연결'
  const reviewed = relation.relationDirection === 'forward' || relation.relationDirection === 'reverse'
  if (relation.relationKind === 'prerequisite' && !reviewed) return '선후 관계 · 방향 미확인'
  if (relation.relationKind === 'instance_of' && !reviewed) return '개념·예시 관계 · 방향 미확인'
  switch (relation.relationKind) {
    case 'prerequisite': return relation.direction === 'incoming' ? '바탕이 되는 질문' : '이어서 살펴볼 질문'
    case 'instance_of': return relation.direction === 'incoming' ? '예시의 바탕 개념' : '개념을 보여주는 예시'
    case 'alternative': return '비교할 대안'
    case 'shares_concept': return '함께 다루는 개념'
    default: return '연관 질문'
  }
}

function connectionLabel(connection: KnowledgeConnection): string {
  const reviewed = connection.relationDirection === 'forward' || connection.relationDirection === 'reverse'
  if (connection.relationKind === 'prerequisite' && !reviewed) return '선후 관계 · 방향 미확인'
  if (connection.relationKind === 'instance_of' && !reviewed) return '개념·예시 관계 · 방향 미확인'
  switch (connection.relationKind) {
    case 'prerequisite': return '바탕 질문 → 이어지는 질문'
    case 'instance_of': return '개념 → 예시'
    case 'alternative': return '대안 비교'
    case 'shares_concept': return '공유하는 개념'
    default: return connection.kind === 'walked' ? '질문 이동 연결' : '연관 관계'
  }
}

/** A read-only join of local records and the public graph. */
export function KnowledgeConnections({ data, onOpen }: { data: MapData; onOpen: (id: string) => void }) {
  const [records, setRecords] = useState<KnowledgeRecords | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const [nextLimit, setNextLimit] = useState(6)
  const [connectionLimit, setConnectionLimit] = useState(8)
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'started' | 'failed'>('idle')

  useEffect(() => {
    const refresh = () => {
      try {
        setRecords(readKnowledgeRecords(window.localStorage))
      } catch {
        setRecords(emptyKnowledgeRecords('unavailable'))
      }
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || STORAGE_KEYS.has(event.key)) refresh()
    }
    refresh()
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refresh)
    window.addEventListener(JOURNEY_SYNCED_EVENT, refresh)
    window.addEventListener(STREAK_SYNCED_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', refresh)
      window.removeEventListener(JOURNEY_SYNCED_EVENT, refresh)
      window.removeEventListener(STREAK_SYNCED_EVENT, refresh)
    }
  }, [])

  const context = useMemo(() => records ? deriveKnowledgeContext(data, records) : null, [data, records])
  const activeCategory = context?.categories.some((item) => item.name === category) ? category : null
  const normalizedQuery = query.trim().toLocaleLowerCase('ko')
  const visibleQuestions = context?.questions.filter((node) => (!activeCategory || node.category === activeCategory)
    && (!normalizedQuery || `${node.question} ${node.category}`.toLocaleLowerCase('ko').includes(normalizedQuery))) ?? []
  const download = () => {
    if (!context) return
    let objectUrl: string | null = null
    let link: HTMLAnchorElement | null = null
    try {
      const generatedAt = new Date().toISOString()
      const markdown = formatKnowledgeMarkdown(context, { origin: siteUrl().origin, generatedAt })
      objectUrl = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
      link = document.createElement('a')
      link.href = objectUrl
      link.download = `cs-pathfinder-connections-${generatedAt.slice(0, 10)}.md`
      document.body.appendChild(link)
      link.click()
      setDownloadStatus('started')
    } catch {
      setDownloadStatus('failed')
    } finally {
      link?.remove()
      // Let the browser consume the user-requested download before releasing it.
      if (objectUrl) {
        const release = objectUrl
        window.setTimeout(() => URL.revokeObjectURL(release), 1000)
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 p-5 pb-12 sm:p-7">
      <section aria-labelledby="knowledge-connections-heading">
        <p className="mb-2 text-[12px] font-semibold tracking-wide text-accent">질문이 쌓인 자리에서</p>
        <h1 id="knowledge-connections-heading" className="text-2xl font-bold leading-snug sm:text-3xl">
          읽은 질문을 연결해서 돌아보기
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-7 text-muted">
          이 브라우저의 읽기·답변 기록을 공개 지도와 함께 봅니다.
          전에 본 질문끼리 어떤 관계가 있는지 확인하고, 그 옆의 질문으로 이어가세요.
        </p>
        <p className="mt-2 text-[12px] leading-6 text-faint">
          읽음·답변 기록은 이해도 평가가 아닙니다. 지도에 있는 질문만 모으며, 원래 기록은 바꾸지 않습니다.
        </p>
      </section>

      {!records && <p role="status" className="text-sm text-muted">이 브라우저의 기록을 읽고 있어요.</p>}
      {records?.status === 'unavailable' && (
        <section className="rounded-2xl border border-line bg-raised p-5" aria-label="기록 읽기 안내">
          <p role="status" className="font-medium">브라우저 기록을 읽을 수 없습니다.</p>
          <p className="mt-2 text-sm leading-7 text-muted">저장소 접근이 허용된 브라우저에서 다시 열어 주세요. 공개 질문은 기록 없이도 읽을 수 있습니다.</p>
          <Link href="/questions" className="mt-3 inline-flex min-h-11 items-center rounded text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">질문 목록 열기 →</Link>
        </section>
      )}
      {records?.status === 'partial' && (
        <p role="status" className="rounded-xl border border-line bg-raised px-4 py-3 text-sm leading-7 text-muted">
          일부 기록을 읽지 못했습니다. 확인할 수 있는 기록만 표시하며, 저장된 내용은 수정하지 않았습니다.
        </p>
      )}

      {context && records?.status !== 'unavailable' && context.questions.length === 0 && (
        <section className="rounded-2xl border border-line bg-raised p-6" aria-label="아직 연결할 기록이 없을 때">
          <h2 className="text-lg font-semibold">공개 지도와 연결되는 기록이 아직 없어요.</h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-muted">전체 지도에서 궁금한 질문의 해설을 열어 보세요. 다시 이 화면에 오면 읽은 질문과 그 주변 연결을 함께 볼 수 있습니다.</p>
          <Link href="/questions" className="mt-3 inline-flex min-h-11 items-center rounded text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">질문 목록에서 시작하기 →</Link>
        </section>
      )}

      {context && context.questions.length > 0 && records?.status !== 'unavailable' && (
        <>
          <dl className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-raised py-4">
            <div className="px-3 text-center"><dt className="text-[12px] text-muted">열어 본 질문</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{context.readCount}</dd></div>
            <div className="px-3 text-center"><dt className="text-[12px] text-muted">답변 기록</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{context.answeredCount}</dd></div>
            <div className="px-3 text-center"><dt className="text-[12px] text-muted">기록 사이 연결</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{context.connections.length}</dd></div>
          </dl>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={download} className="inline-flex min-h-11 items-center rounded-lg border border-line bg-raised px-4 text-sm font-medium text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">연결 정리 내려받기</button>
            <p className="text-[12px] leading-6 text-faint">질문·관계·읽기/답변 표시를 Markdown으로 저장합니다. 내 답변 본문은 포함하지 않습니다.</p>
            {downloadStatus !== 'idle' && <p role="status" className="w-full text-[12px] text-muted">{downloadStatus === 'started' ? '다운로드를 시작했습니다. 브라우저의 다운로드 목록을 확인해 주세요.' : '다운로드를 시작하지 못했습니다. 기록은 그대로입니다. 다시 시도해 주세요.'}</p>}
          </div>

          <section aria-labelledby="next-knowledge-heading">
            <h2 id="next-knowledge-heading" className="text-lg font-semibold">기록한 질문과 연결된 질문</h2>
            <p className="mb-4 mt-1 text-[13px] leading-6 text-muted">기록이 있는 질문과 이어져 있지만, 이 브라우저의 읽기·답변 기록에는 아직 없는 질문입니다. 추정된 관계는 틀릴 수 있습니다. 방향 미확인 표시는 학습 순서를 뜻하지 않으니 이유를 함께 살펴보세요.</p>
            {context.next.length === 0 ? (
              <p className="rounded-xl border border-line p-4 text-sm leading-7 text-muted">공개 지도에서 새로 이어갈 질문을 찾지 못했어요. 연결이 없다는 것이 학습이 끝났거나 부족하다는 뜻은 아닙니다.</p>
            ) : (
              <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
                {context.next.slice(0, nextLimit).map(({ node, anchors }) => {
                  const anchor = anchors[0]
                  return (
                    <li key={node.id} className="rounded-2xl border border-line bg-surface p-4">
                      <p className="text-[11px] font-medium text-accent">{nextRelationLabel(anchor.relation)} · {node.category}</p>
                      <button type="button" onClick={() => onOpen(node.id)} className={`${QUESTION_BUTTON} mt-2 min-h-11 text-[15px] leading-6`}>{node.question}</button>
                      <p className="mt-2 text-[12px] leading-6 text-muted">{anchor.node.question}와 연결돼 있습니다.</p>
                      {anchor.relation.reason && <p className="mt-1 text-[12px] leading-6 text-faint">{anchor.relation.reason}</p>}
                      {anchors.length > 1 && <p className="mt-2 text-[11px] text-faint">기록한 질문 {anchors.length}개와 연결</p>}
                    </li>
                  )
                })}
              </ul>
            )}
            {context.next.length > 6 && <button type="button" aria-disabled={nextLimit >= context.next.length} onClick={() => { if (nextLimit < context.next.length) setNextLimit((limit) => Math.min(context.next.length, limit + 6)) }} className="mt-3 min-h-11 rounded-lg border border-line px-4 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{nextLimit >= context.next.length ? '연결된 질문 모두 표시함' : <>연결된 질문 더 보기 <span className="text-muted">({context.next.length - nextLimit}개 남음)</span></>}</button>}
          </section>

          <section aria-labelledby="recorded-connections-heading">
            <h2 id="recorded-connections-heading" className="text-lg font-semibold">이미 본 질문 사이의 관계</h2>
            <p className="mb-3 mt-1 text-[13px] leading-6 text-muted">공개 지도에 있는 연결입니다. 추정된 관계는 틀릴 수 있으니 연결 이유를 함께 살펴보세요.</p>
            {context.connections.length === 0 ? (
              <p className="rounded-xl border border-line p-4 text-sm leading-7 text-muted">기록한 질문 사이에 지도에 표시된 연결은 아직 없어요. 아래에서 개별 질문을 다시 열어 볼 수 있습니다.</p>
            ) : (
              <ul className="list-none space-y-3 p-0">
                {context.connections.slice(0, connectionLimit).map((connection) => (
                  <li key={`${connection.from.id}:${connection.to.id}`} className="rounded-xl border border-line bg-raised p-4">
                    <p className="mb-2 text-[11px] font-medium text-accent">{connectionLabel(connection)}</p>
                    <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <button type="button" onClick={() => onOpen(connection.from.id)} className={`${QUESTION_BUTTON} min-h-11 text-sm leading-6`}>{connection.from.question}</button>
                      <span aria-hidden className="text-faint">{connection.kind === 'walked' || ((connection.relationDirection === 'forward' || connection.relationDirection === 'reverse') && (connection.relationKind === 'prerequisite' || connection.relationKind === 'instance_of')) ? '→' : '↔'}</span>
                      <button type="button" onClick={() => onOpen(connection.to.id)} className={`${QUESTION_BUTTON} min-h-11 text-sm leading-6`}>{connection.to.question}</button>
                    </div>
                    {connection.reason && <p className="mt-2 text-[12px] leading-6 text-muted">{connection.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
            {context.connections.length > 8 && <button type="button" aria-disabled={connectionLimit >= context.connections.length} onClick={() => { if (connectionLimit < context.connections.length) setConnectionLimit((limit) => Math.min(context.connections.length, limit + 8)) }} className="mt-3 min-h-11 rounded-lg border border-line px-4 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{connectionLimit >= context.connections.length ? '기록 사이 연결 모두 표시함' : <>기록 사이 연결 더 보기 <span className="text-muted">({context.connections.length - connectionLimit}개 남음)</span></>}</button>}
          </section>

          <section aria-labelledby="recorded-questions-heading">
            <h2 id="recorded-questions-heading" className="text-lg font-semibold">분야별로 다시 찾기</h2>
            <div className="my-3 flex flex-wrap gap-2" role="group" aria-label="기록한 질문 분야">
              {[{ name: null, count: context.questions.length }, ...context.categories].map(({ name, count }) => (
                <button key={name ?? 'all'} type="button" aria-pressed={activeCategory === name} onClick={() => setCategory(name)} className="min-h-10 rounded-full border border-line px-3 text-[12px] text-muted aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{name ?? '전체'} {count}</button>
              ))}
            </div>
            <div className="mb-4">
              <label htmlFor="recorded-question-search" className="mb-2 block text-sm font-medium">기록한 질문 검색</label>
              <div className="flex items-center gap-2">
                <input ref={searchInput} id="recorded-question-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-describedby="recorded-question-search-help" placeholder="질문 제목이나 분야" className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
                {query && <button type="button" onClick={() => { setQuery(''); searchInput.current?.focus() }} className="min-h-11 shrink-0 rounded-lg border border-line px-3 text-sm text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">검색 지우기</button>}
              </div>
              <p id="recorded-question-search-help" className="mt-2 text-[12px] leading-6 text-faint">선택한 분야 안에서 제목·분야를 찾습니다. 답변 본문은 검색하지 않습니다.</p>
              <p role="status" className="mt-1 text-[12px] text-muted">{visibleQuestions.length}개 질문 표시</p>
            </div>
            {visibleQuestions.length === 0 && <p className="mb-3 rounded-xl border border-line p-4 text-sm leading-7 text-muted">조건에 맞는 기록한 질문이 없습니다. 검색어를 지우거나 다른 분야를 선택해 보세요.</p>}
            <ul className="grid list-none gap-2 p-0 sm:grid-cols-2">
              {visibleQuestions.map((node) => (
                <li key={node.id} className="rounded-xl border border-line p-3">
                  <p className="text-[11px] text-faint">{node.category}{node.read ? ' · 열어 봄' : ''}{node.answered ? ' · 답변 기록' : ''}{node.needsReview ? ' · 다시 볼 표시' : ''}</p>
                  <button type="button" onClick={() => onOpen(node.id)} className={`${QUESTION_BUTTON} mt-1 min-h-11 text-[14px] leading-6`}>{node.question}</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
