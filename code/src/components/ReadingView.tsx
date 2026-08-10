'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadStreak, saveStreak, todayKst } from '@/lib/streak/client'
import { recordRead } from '@/lib/streak/storage'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  startJourney,
  enterAsRoot,
  visit,
  moveTo,
  pathTo,
  ancestorNodeIds,
  currentOccurrence,
  findOccurrenceByNode,
} from '@/lib/journey/path'
import { layoutJourney } from '@/lib/journey/graph'
import { loadJourney, saveJourney } from '@/lib/journey/storage'
import { mergeJourney } from '@/lib/journey/merge'
import { JOURNEY_SYNCED_EVENT } from '@/lib/journey/sync'
import type { JourneyState } from '@/lib/journey/types'
import { requestExpand, type PublicNode, type PublicSuggestion } from '@/lib/api/expand-client'
import { PathChips } from '@/components/PathChips'
import { Suggestions } from '@/components/Suggestions'
import { FreeInput } from '@/components/FreeInput'
import { Prose } from '@/components/Prose'
import { Banner, GeneratingBody, ExpandingNote, type BannerState } from '@/components/Banners'
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

export type QuotaSnapshot = { used: number; limit: number }

export function ReadingView({
  initialNode,
  initialQuota,
}: {
  initialNode: ReadingNode
  initialQuota: QuotaSnapshot
}) {
  const [journey, setJourney] = useState<JourneyState>(() => startJourney(toVisited(initialNode)))
  const [node, setNode] = useState<ReadingNode>(initialNode)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [expanding, setExpanding] = useState(false)
  const [loadingNode, setLoadingNode] = useState(false)
  const [banner, setBanner] = useState<BannerState>({ kind: 'none' })
  /**
   * 남은 횟수는 서버가 준 값에서 시작한다.
   *
   * 클라이언트가 따로 물으면 한 번 더 왕복하고 그 사이에 숫자가 없는 순간이 생긴다.
   * 이후로는 확장 응답이 실제 값을 실어 오므로 그것으로 갱신한다.
   */
  const [quota, setQuota] = useState<QuotaSnapshot>(initialQuota)
  const quotaExceeded = quota.limit > 0 && quota.used >= quota.limit
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)

  // 경로 칩과 미니맵으로 되돌아갈 때 본문을 다시 받지 않으려고 들고 있는다.
  const cache = useRef(new Map<string, ReadingNode>([[initialNode.id, initialNode]]))
  const lastAttempt = useRef<Attempt | null>(null)
  const restored = useRef(false)
  /*
   * 복원이 끝나기 전에는 저장하지 않는다.
   *
   * useState의 초기값은 1개짜리 새 여정이다. 게이트 없이는 그것이 복원보다
   * 먼저 저장 훅을 타고 localStorage를 한 틱 덮는다 — 그 틱에 언마운트되거나
   * 다른 탭이 읽으면 기록을 잃는다. 서버 동기화(C4)가 끼면 그 1개짜리가
   * 서버로도 올라간다.
   */
  const [hydrated, setHydrated] = useState(false)

  // ── 저장된 여정 복원 ──────────────────────────────────────
  useEffect(() => {
    if (restored.current) return
    restored.current = true

    const saved = loadJourney()
    if (!saved) {
      setHydrated(true)
      return
    }

    // 이미 판 자리면 그리로 돌아간다
    const hit = saved.occurrences.find((o) => o.nodeId === initialNode.id)
    if (hit) {
      setJourney(moveTo(saved, hit.id))
      setHydrated(true)
      return
    }

    /*
     * 저장된 여정에 없는 질문이면 **새 뿌리로 붙인다.**
     *
     * 전에는 여기서 그냥 넘어갔다. 그러면 아래 저장 훅이 곧바로 1개짜리 새
     * 여정으로 저장소를 덮어써서, **판 것이 통째로 날아갔다.** 새 탭으로 질문을
     * 열거나 공유 링크를 타고 들어오면 그렇게 됐다.
     *
     * 재현: 두 노드를 판 상태에서 여정에 없는 `/q/...`를 새 탭에 열면 지도가
     * 2에서 1로, 깊이가 1에서 0으로 떨어졌다.
     */
    setJourney(enterAsRoot(saved, toVisited(initialNode)).state)
    setHydrated(true)
  }, [initialNode])

  useEffect(() => {
    if (!hydrated) return
    saveJourney(journey)
  }, [journey, hydrated])

  /*
   * 서버 병합 결과를 메모리 상태에 **더하기로** 받아들인다 (C4).
   *
   * sync가 localStorage만 고치면 이 화면의 저장 훅이 옛 메모리 상태로 도로
   * 덮는다 — 지난 버그와 같은 모양이다. 서버 데이터는 반드시 여기(메모리)를
   * 통과해야 한다. mergeJourney는 합집합이라 이벤트가 언제 도착하든 어느 쪽
   * 발자국도 죽지 않고, currentId는 로컬(보고 있는 자리)이 이긴다.
   */
  useEffect(() => {
    const onSynced = (e: Event) => {
      const merged = (e as CustomEvent<JourneyState>).detail
      if (!merged || !Array.isArray(merged.occurrences)) return
      setJourney((prev) => mergeJourney(prev, merged.occurrences, merged.currentId))
    }
    window.addEventListener(JOURNEY_SYNCED_EVENT, onSynced)
    return () => window.removeEventListener(JOURNEY_SYNCED_EVENT, onSynced)
  }, [])

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

  /**
   * 오늘 이 질문을 팠다고 적는다.
   *
   * 여정에도 발자국이 남지만 **거기에는 시각이 없다**(`journey/types.ts`).
   * 잔디는 날짜가 있어야 그린다. 여정 형식을 바꾸면 지금 저장된 기록이 통째로
   * 버려지므로 따로 적는다.
   *
   * 같은 질문을 다시 열어도 그날 한 번만 센다. 새로고침으로 잔디가 진해지면
   * 그 숫자는 아무 뜻이 없다.
   */
  useEffect(() => {
    const day = todayKst()
    const before = loadStreak()
    const after = recordRead(before, day, node.id)
    if (after !== before) saveStreak(after)
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
          number: typeof raw.number === 'number' ? raw.number : 0,
          question: raw.question,
          body: raw.body,
          identityScope: raw.identity_scope,
          tags: Array.isArray(raw.tags) ? raw.tags : [],
          level: typeof raw.level === 'string' ? raw.level : null,
          category: raw.category,
          suggestions: raw.suggestions,
        }
        cache.current.set(loaded.id, loaded)
        setNode(loaded)
      } catch {
        setBanner({ kind: 'error', message: '질문을 불러오지 못했습니다.' })
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
          setQuota(res.quota)
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
          // 서버가 막았으면 실제로 다 쓴 것이다. 화면 숫자를 그 사실에 맞춘다
          setQuota((q) => ({ ...q, used: q.limit }))
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
          {/*
            **글자와 가는 곳이 달랐다.** `← 질문 목록`이라고 쓰고 `/`로 보냈다.
            같은 화면 헤더의 `질문 목록`은 `/questions`로 가므로, 글자가 같은
            링크 둘이 서로 다른 데로 갔다. 대문에도 "목록으로 돌아가요"라고
            적혀 있다. 글자를 믿고 `/questions`로 맞춘다.

            누르는 자리도 같이 키운다. 폰에서 20px이었다. 위로 27px·아래로
            681px이 비어 있어 판정만 늘려도 겹칠 것이 없다. `py`를 키우고 같은
            만큼 `-my`로 당기면 줄 높이는 안 변한다 — 게시판 칩과 같은 방식이다.
            오른쪽 끝의 깊이·공유와는 가로로 멀리 떨어져 있다.
          */}
          <Link
            href="/questions"
            className="-my-[12px] py-[12px] text-[13px] font-medium text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            ← 질문 목록
          </Link>
          <div className="flex items-center gap-3">
            {/*
              번호를 보여준다. 레포와 이슈에서 이 질문을 부르는 이름이고
              주소에도 `/q/3`으로 쓸 수 있다. 36자짜리 UUID는 사람이 못 부른다.
            */}
            {node.number > 0 && (
              <span className="font-mono text-[11px] text-faint">#{node.number}</span>
            )}
            <span className="font-mono text-[11px] text-faint">깊이 {path.length - 1}</span>
            {/* 파고든 다음에야 공유할 게 생긴다. 버튼은 스스로 그때 나타난다 */}
            <ShareSheet journey={journey} />
          </div>
        </div>

        <PathChips path={path} onJump={(id) => void goTo(id)} />

        <h1 className="mt-6 text-[24px] font-semibold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[30px] sm:leading-[1.32]">
          {node.question}
        </h1>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-faint">
          <span>
            {node.category} <span className="font-mono">· {node.identityScope}</span>
          </span>
          {/*
            태그·난이도 칩. 링크가 /questions 필터로 간다 — "이 주제 더"가
            칩의 뜻이다. 확장으로 노드가 바뀌면 API 응답에 실려 온 값으로
            같이 바뀐다(안 실려 오면 그냥 안 그린다).
          */}
          {node.level && (
            <a
              href={`/questions?level=${encodeURIComponent(node.level)}`}
              className="rounded-full border border-line px-2 py-0.5 text-muted hover:border-accent hover:text-ink"
            >
              {node.level}
            </a>
          )}
          {node.tags.map((t) => (
            <a
              key={t}
              href={`/questions?tag=${encodeURIComponent(t)}`}
              className="rounded-full border border-line px-2 py-0.5 text-muted hover:border-accent hover:text-ink"
            >
              {t}
            </a>
          ))}
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

          {/*
            `aria-busy`가 있어야 화면 낭독기가 "지금 바뀌는 중"을 안다.
            버튼이 안 눌리는 이유를 눈으로만 알 수 있으면 안 된다.
          */}
          <section aria-busy={expanding || undefined}>
            <h2 className="mb-3 text-[13px] font-medium text-muted">더 파고들기</h2>
            <Suggestions
              suggestions={node.suggestions}
              pendingId={pendingId}
              disabled={busy}
              onPick={(s) => void run({ mode: 'suggestion', suggestion: s })}
            />
            {/*
              35초를 말없이 두지 않는다.

              재보니 누르고 새 화면까지 35초였고 그동안 바뀌는 것은 화살표가
              `···`이 되는 것뿐이었다. 그 정도로는 멈춘 것과 구별이 안 된다.
            */}
            {expanding && pendingId !== null && <ExpandingNote />}
          </section>

          <div className="pt-2">
            <FreeInput
              disabled={busy}
              pending={expanding && pendingId === null}
              quotaExceeded={quotaExceeded}
              remaining={Math.max(0, quota.limit - quota.used)}
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
