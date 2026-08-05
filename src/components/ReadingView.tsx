'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  startJourney,
  visit,
  moveTo,
  pathTo,
  ancestorNodeIds,
  currentOccurrence,
  findOccurrenceByNode,
} from '@/lib/journey/path'
import { layoutJourney } from '@/lib/journey/graph'
import { loadJourney, saveJourney } from '@/lib/journey/storage'
import type { JourneyState } from '@/lib/journey/types'
import { requestExpand, type PublicNode, type PublicSuggestion } from '@/lib/api/expand-client'
import { PathChips } from '@/components/PathChips'
import { Suggestions } from '@/components/Suggestions'
import { FreeInput } from '@/components/FreeInput'
import { Prose } from '@/components/Prose'
import { Banner, GeneratingBody, type BannerState } from '@/components/Banners'
import { MinimapStrip } from '@/components/MinimapStrip'
import { ShareSheet } from '@/components/ShareSheet'

// React Flow는 무겁고 서버 렌더가 필요 없다. 지도를 열 때만 가져온다.
const MapModal = dynamic(() => import('@/components/MapModal').then((m) => m.MapModal), {
  ssr: false,
})

export type ReadingNode = PublicNode & { category: string }

type Attempt =
  | { mode: 'suggestion'; suggestion: PublicSuggestion }
  | { mode: 'free'; rawInput: string }

export function ReadingView({ initialNode }: { initialNode: ReadingNode }) {
  const [journey, setJourney] = useState<JourneyState>(() => startJourney(toVisited(initialNode)))
  const [node, setNode] = useState<ReadingNode>(initialNode)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [expanding, setExpanding] = useState(false)
  const [loadingNode, setLoadingNode] = useState(false)
  const [banner, setBanner] = useState<BannerState>({ kind: 'none' })
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)

  // 경로 칩과 미니맵으로 되돌아갈 때 본문을 다시 받지 않으려고 들고 있는다.
  const cache = useRef(new Map<string, ReadingNode>([[initialNode.id, initialNode]]))
  const lastAttempt = useRef<Attempt | null>(null)
  const restored = useRef(false)

  // ── 저장된 여정 복원 ──────────────────────────────────────
  useEffect(() => {
    if (restored.current) return
    restored.current = true

    const saved = loadJourney()
    if (!saved) return

    // URL의 노드가 저장된 여정 안에 있으면 이어서 판다. 없으면 새 여정이다.
    const hit = saved.occurrences.find((o) => o.nodeId === initialNode.id)
    if (hit) setJourney(moveTo(saved, hit.id))
  }, [initialNode.id])

  useEffect(() => {
    saveJourney(journey)
  }, [journey])

  // ── 뒤로가기 ─────────────────────────────────────────────
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const occId = (e.state as { occId?: string } | null)?.occId
      if (occId) void goTo(occId, false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // goTo는 journey에 의존하지만 리스너는 최신 클로저를 ref 없이 잡는다.
    // journey를 의존성에 넣어 매번 다시 건다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey])

  const layout = useMemo(() => layoutJourney(journey), [journey])
  const path = useMemo(
    () => (journey.currentId ? pathTo(journey, journey.currentId) : []),
    [journey],
  )

  const pushUrl = (nodeId: string, occId: string, push: boolean) => {
    const url = `/q/${nodeId}`
    if (push) window.history.pushState({ occId }, '', url)
    else window.history.replaceState({ occId }, '', url)
  }

  /**
   * 질문이 바뀌면 맨 위로 올린다.
   *
   * 추천은 화면 아래에 있어 누른 자리에 그대로 두면 새 질문의 제목과 해설 앞부분이
   * 화면 밖에 남는다. 읽을 것이 바뀌었는데 읽던 위치를 유지할 이유가 없다.
   *
   * 핸들러 안에서 부르면 안 된다. 리렌더로 문서 높이가 바뀌며 브라우저가 스크롤을
   * 되돌린다. 렌더가 끝난 뒤에 옮겨야 한다.
   */
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [node.id])

  /** 이미 지나온 발자국으로 이동한다. 본문은 캐시에 없으면 받아온다 */
  const goTo = useCallback(
    async (occurrenceId: string, push = true) => {
      const occ = journey.occurrences.find((o) => o.id === occurrenceId)
      if (!occ) return

      setJourney((s) => moveTo(s, occurrenceId))
      setBanner({ kind: 'none' })
      setJustAddedId(null)
      pushUrl(occ.nodeId, occurrenceId, push)

      const cached = cache.current.get(occ.nodeId)
      if (cached) {
        setNode(cached)
        return
      }

      setLoadingNode(true)
      try {
        const res = await fetch(`/api/node/${occ.nodeId}`)
        if (!res.ok) throw new Error('load failed')
        const raw = await res.json()
        const loaded: ReadingNode = {
          id: raw.id,
          question: raw.question,
          body: raw.body,
          identityScope: raw.identity_scope,
          category: raw.category,
          suggestions: raw.suggestions,
        }
        cache.current.set(loaded.id, loaded)
        setNode(loaded)
      } catch {
        setBanner({ kind: 'error', message: '질문을 불러오지 못했어요.' })
      } finally {
        setLoadingNode(false)
      }
    },
    [journey],
  )

  const run = useCallback(
    async (attempt: Attempt) => {
      const cur = currentOccurrence(journey)
      if (!cur || expanding) return

      lastAttempt.current = attempt
      setExpanding(true)
      setBanner({ kind: 'none' })
      setPendingId(attempt.mode === 'suggestion' ? attempt.suggestion.id : null)

      const res = await requestExpand({
        parentNodeId: node.id,
        ancestorNodeIds: ancestorNodeIds(journey, cur.id),
        mode: attempt.mode,
        suggestionId: attempt.mode === 'suggestion' ? attempt.suggestion.id : undefined,
        rawInput: attempt.mode === 'free' ? attempt.rawInput : undefined,
      })

      setExpanding(false)
      setPendingId(null)

      switch (res.kind) {
        case 'ok': {
          // 새 노드의 카테고리는 서버가 부모에서 물려받는다. 클라이언트도 같게 맞춘다.
          const next: ReadingNode = { ...res.node, category: node.category }
          cache.current.set(next.id, next)

          const { state, occurrenceId } = visit(journey, cur.id, toVisited(next))
          setJourney(state)
          setNode(next)
          setJustAddedId(occurrenceId)
          setQuotaExceeded(res.quota.limit > 0 && res.quota.used >= res.quota.limit)
          pushUrl(next.id, occurrenceId, true)
          return
        }

        case 'ancestor_jump': {
          const target = findOccurrenceByNode(journey, cur.id, res.nodeId)
          if (target) {
            await goTo(target)
            setBanner({ kind: 'ancestor_jump', question: '' })
          }
          return
        }

        case 'rejected':
          setBanner({ kind: 'rejected', reason: res.reason })
          return

        case 'quota_exceeded':
          setQuotaExceeded(true)
          setBanner({ kind: 'quota_exceeded' })
          return

        case 'rate_limited':
          setBanner({ kind: 'rate_limited', retryAfter: res.retryAfter })
          return

        case 'gate_unavailable':
          setBanner({ kind: 'gate_unavailable' })
          return

        case 'error':
          setBanner({ kind: 'error', message: res.message })
      }
    },
    [journey, node, expanding, goTo],
  )

  const busy = expanding || loadingNode

  return (
    <>
      <main className="mx-auto max-w-3xl px-5 pb-40 pt-5 sm:px-8 sm:pt-8">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/"
            className="text-[13px] font-medium text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ← 질문 목록
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-faint">깊이 {path.length - 1}</span>
            {/* 파고든 다음에야 공유할 게 생긴다. 버튼은 스스로 그때 나타난다 */}
            <ShareSheet journey={journey} />
          </div>
        </div>

        <PathChips path={path} onJump={(id) => void goTo(id)} />

        <h1 className="mt-6 text-[24px] font-semibold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[30px] sm:leading-[1.32]">
          {node.question}
        </h1>

        <p className="mt-3 text-[12px] text-faint">
          {node.category} <span className="font-mono">· {node.identityScope}</span>
        </p>

        <div className="mt-7">
          {loadingNode ? <GeneratingBody /> : <Prose body={node.body} />}
        </div>

        <div className="mt-8 space-y-4">
          <Banner
            state={banner}
            onRetry={
              lastAttempt.current ? () => void run(lastAttempt.current as Attempt) : undefined
            }
          />

          <section>
            <h2 className="mb-3 text-[13px] font-medium text-muted">더 파고들기</h2>
            <Suggestions
              suggestions={node.suggestions}
              pendingId={pendingId}
              disabled={busy}
              onPick={(s) => void run({ mode: 'suggestion', suggestion: s })}
            />
          </section>

          <div className="pt-2">
            <FreeInput
              disabled={busy}
              pending={expanding && pendingId === null}
              quotaExceeded={quotaExceeded}
              onSubmit={(text) => void run({ mode: 'free', rawInput: text })}
            />
          </div>
        </div>
      </main>

      <MinimapStrip
        layout={layout}
        justAddedId={justAddedId}
        onJump={(id) => void goTo(id)}
        onOpenMap={() => setMapOpen(true)}
      />

      {mapOpen && (
        <MapModal layout={layout} onJump={(id) => void goTo(id)} onClose={() => setMapOpen(false)} />
      )}
    </>
  )
}

function toVisited(n: ReadingNode) {
  return { id: n.id, question: n.question, category: n.category }
}
