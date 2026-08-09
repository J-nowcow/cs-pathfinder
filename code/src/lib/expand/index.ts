import { questionHash } from '@/lib/expand/hash'
import { validateRawInput, type ValidationErrorCode } from '@/lib/expand/validate'
import { lookupByHash, loadNode, type CachedNode } from '@/lib/expand/cache'
import { acquireLease, completeLease, failLease } from '@/lib/expand/singleflight'
import { findAncestorHit } from '@/lib/expand/ancestor'
import {
  insertNode,
  insertSuggestions,
  bindAlias,
  ensureEdge,
  resolveSuggestion,
  recordEvent,
  collectCandidates,
  linkSuggestion,
} from '@/lib/expand/nodes'
import { runGate, NORMALIZER_VERSION } from '@/lib/llm/gate'
import { generateNodeContent } from '@/lib/llm/generate'
import { reserveQuota, commitQuota, releaseQuota, getQuota } from '@/lib/quota'
import type { StructuredCaller } from '@/lib/llm/client'

export type ExpandInput = {
  quotaKey: string
  dailyLimit: number
  parentNodeId: string
  ancestorNodeIds: string[]
  mode: 'suggestion' | 'free'
  suggestionId?: string
  rawInput?: string
  call?: StructuredCaller
}

/**
 * `hit`은 게이트가 기존 노드를 골랐다는 뜻이다.
 * 초판에서는 해시 조회 적중을 뜻했는데 그 경로는 보조로 밀렸다(스펙 부록 D).
 */
export type CacheStatus = 'hit' | 'miss' | 'suggestion_resolved'

export type ExpandOutcome =
  | { kind: 'ok'; node: CachedNode; cache: CacheStatus; quota: { used: number; limit: number } }
  | { kind: 'invalid'; code: ValidationErrorCode; detail: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'ancestor_jump'; ancestorIndex: number; nodeId: string }
  | { kind: 'quota_exceeded' }
  | { kind: 'busy' }
  | { kind: 'generation_failed' }
  | { kind: 'not_found'; what: 'parent' | 'suggestion' }

const BUSY_WAIT_MS = 400
const BUSY_RETRIES = 5

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function snapshot(key: string, limit: number) {
  const q = await getQuota(key)
  return { used: q.used, limit }
}

/**
 * 확장 뒤에 꼬리질문과 결과 노드를 잇는다.
 *
 * 성공 경로가 여섯이다 — 해소된 추천, 매칭, 해시 캐시, 리스 완료, 새 생성,
 * 그리고 각각의 조상 점프. 안쪽에서 하나씩 이으면 새 경로가 생길 때 또 빠뜨린다.
 * 실제로 빠뜨려서 `suggestion_resolved` 경로가 통째로 죽어 있었다.
 *
 * 바깥에서 한 번 이으면 경로가 늘어도 자동으로 걸린다.
 */
export async function expand(input: ExpandInput): Promise<ExpandOutcome> {
  const outcome = await runExpand(input)

  if (input.mode === 'suggestion' && input.suggestionId) {
    const nodeId =
      outcome.kind === 'ok'
        ? outcome.node.id
        : outcome.kind === 'ancestor_jump'
          ? outcome.nodeId
          : null

    if (nodeId) await linkSuggestion(input.suggestionId, nodeId)
  }

  return outcome
}

async function runExpand(input: ExpandInput): Promise<ExpandOutcome> {
  const parent = await loadNode(input.parentNodeId)
  if (!parent) return { kind: 'not_found', what: 'parent' }

  // ── 1. 입력 결정 ──────────────────────────────────────────
  let questionText: string

  if (input.mode === 'suggestion') {
    if (!input.suggestionId) return { kind: 'not_found', what: 'suggestion' }
    const sug = await resolveSuggestion(input.suggestionId)
    if (!sug) return { kind: 'not_found', what: 'suggestion' }

    // 이미 해소된 추천은 LLM을 전혀 태우지 않는다.
    // 이 경로가 전체 확장의 대부분을 차지한다.
    if (sug.targetNodeId) {
      const hit = findAncestorHit(input.ancestorNodeIds, sug.targetNodeId)
      if (hit !== null) {
        /*
         * 이 경로도 기록한다. 주석이 "전체 확장의 대부분"이라 부르는 경로가
         * 이벤트를 안 남겨서, expansion_event로 확장량을 세면 대부분이
         * 빠지는 상태였다. 스펙 §5가 임베딩 검색을 켜는 조건으로 지정한
         * "같은 개념 재생성 비율"도 이 구멍 때문에 잴 수 없었다.
         */
        await recordEvent({
          parentNodeId: input.parentNodeId,
          rawInput: sug.text,
          verdict: 'accepted',
          resultingNodeId: sug.targetNodeId,
          matchedNodeId: sug.targetNodeId,
          matchedVia: 'ancestor',
        })
        return { kind: 'ancestor_jump', ancestorIndex: hit, nodeId: sug.targetNodeId }
      }
      const node = await loadNode(sug.targetNodeId)
      if (!node) return { kind: 'not_found', what: 'suggestion' }
      await ensureEdge(input.parentNodeId, node.id)
      await recordEvent({
        parentNodeId: input.parentNodeId,
        rawInput: sug.text,
        verdict: 'accepted',
        resultingNodeId: node.id,
        matchedNodeId: node.id,
        matchedVia: 'suggestion',
      })
      return {
        kind: 'ok',
        node,
        cache: 'suggestion_resolved',
        quota: await snapshot(input.quotaKey, input.dailyLimit),
      }
    }

    questionText = sug.text
  } else {
    const validation = validateRawInput(input.rawInput ?? '')
    if (!validation.ok) {
      return { kind: 'invalid', code: validation.code, detail: validation.detail }
    }
    questionText = validation.value
  }

  const rawInput = questionText

  // ── 2. 후보 수집 ──────────────────────────────────────────
  // DB 조회다. LLM을 태우지 않는다.
  const candidates = await collectCandidates(input.parentNodeId)
  const candidateIds = candidates.map((c) => c.id)

  // ── 3. 매칭 게이트 ────────────────────────────────────────
  // 매칭에 성공해도 이 호출은 발생한다.
  // "매칭은 LLM 0회"가 아니라 "매칭은 생성 LLM 0회"가 정확하다.
  const gate = await runGate({
    parentQuestion: parent.question,
    candidates,
    rawInput: questionText,
    call: input.call,
  })

  if (!gate.relevant) {
    await recordEvent({
      parentNodeId: input.parentNodeId,
      rawInput,
      verdict: 'rejected',
      rejectReason: gate.reason,
      candidateIds,
      gateVersion: NORMALIZER_VERSION,
    })
    return { kind: 'rejected', reason: gate.reason }
  }

  // ── 4. 매칭됨 — 생성 없이 그 노드로 ───────────────────────
  if (gate.matchedId !== null) {
    const hit = findAncestorHit(input.ancestorNodeIds, gate.matchedId)
    if (hit !== null) {
      await recordEvent({
        parentNodeId: input.parentNodeId,
        rawInput,
        verdict: 'accepted',
        resultingNodeId: gate.matchedId,
        candidateIds,
        matchedNodeId: gate.matchedId,
        matchedVia: 'ancestor',
        gateVersion: NORMALIZER_VERSION,
      })
      return { kind: 'ancestor_jump', ancestorIndex: hit, nodeId: gate.matchedId }
    }

    const node = await loadNode(gate.matchedId)
    if (node) {
      await ensureEdge(input.parentNodeId, node.id)
      await recordEvent({
        parentNodeId: input.parentNodeId,
        rawInput,
        verdict: 'accepted',
        resultingNodeId: node.id,
        candidateIds,
        matchedNodeId: node.id,
        /*
         * 'gate'와 'hash'를 가른다. 전에는 둘 다 matched_node_id만 채워서
         * 게이트가 고른 것과 같은 문장이 다시 온 것이 로그에서 구분되지
         * 않았다 — 매칭률을 재는 순간 틀린 값이 나오는 상태였다.
         */
        matchedVia: 'gate',
        gateVersion: NORMALIZER_VERSION,
      })
      return {
        kind: 'ok',
        node,
        cache: 'hit',
        quota: await snapshot(input.quotaKey, input.dailyLimit),
      }
    }
    // 매칭된 노드가 사라졌으면 새로 만드는 경로로 떨어진다.
  }

  // 여기부터는 새 노드를 만드는 경로다.
  const identityScope = gate.matchedId === null ? gate.identityScope : parent.identityScope
  const normalizedQuestion = gate.matchedId === null ? gate.normalizedQuestion : questionText
  const hash = questionHash(identityScope, normalizedQuestion)

  // ── 5. 보조 조회 ──────────────────────────────────────────
  // 정확히 같은 문장이 다시 들어온 경우만 잡는다. 적중을 기대하지 않는다.
  const cached = await lookupByHash(hash)
  if (cached) {
    const hit = findAncestorHit(input.ancestorNodeIds, cached.id)
    if (hit !== null) {
      await recordEvent({
        parentNodeId: input.parentNodeId,
        rawInput,
        verdict: 'accepted',
        resultingNodeId: cached.id,
        candidateIds,
        matchedNodeId: cached.id,
        matchedVia: 'ancestor',
        gateVersion: NORMALIZER_VERSION,
      })
      return { kind: 'ancestor_jump', ancestorIndex: hit, nodeId: cached.id }
    }
    await ensureEdge(input.parentNodeId, cached.id)
    await recordEvent({
      parentNodeId: input.parentNodeId,
      rawInput,
      verdict: 'accepted',
      resultingNodeId: cached.id,
      candidateIds,
      matchedNodeId: cached.id,
      matchedVia: 'hash',
      gateVersion: NORMALIZER_VERSION,
    })
    return {
      kind: 'ok',
      node: cached,
      cache: 'hit',
      quota: await snapshot(input.quotaKey, input.dailyLimit),
    }
  }

  // ── 6. 할당량 예약 ────────────────────────────────────────
  if (!(await reserveQuota(input.quotaKey, input.dailyLimit))) {
    return { kind: 'quota_exceeded' }
  }

  // ── 7. single-flight 선점 ────────────────────────────────
  let lease = await acquireLease(hash)
  for (let i = 0; i < BUSY_RETRIES && lease.result === 'busy'; i += 1) {
    await sleep(BUSY_WAIT_MS)
    lease = await acquireLease(hash)
  }

  /*
   * 캐시가 가리키는 노드가 없을 수 있다.
   *
   * 두 모양이 있고 **둘 다 받아야 한다.**
   *
   *   qnodeId는 있는데 그 노드가 안 읽힌다
   *   qnodeId 자체가 null이다
   *
   * 두 번째가 실제로 흔한 쪽이다. `generation_job.qnode_id`가
   * `on delete set null`(0002_ops.sql:23)이라 노드를 지우면 id가 null로 바뀐다.
   * 재발행·purge-stubs·dedupe-roots가 전부 노드를 지우므로 이 경로로 온다.
   *
   * 처음에는 가드를 `done && qnodeId`로 뒀는데 그래서 안 켜졌다. 노드를 지워
   * 상황을 만들면 qnodeId가 null이 되어 조건을 통과 못 한다 — 막으려던 바로
   * 그 경우를 비껴갔다. 시험 셋도 전부 새 코드를 한 줄도 안 지났다.
   *
   * 옛 흐름은 여기서 `releaseQuota`를 먼저 하고 아래 생성 구간으로 흘러들었다.
   * 예약을 반납한 채 LLM을 태우고, 리스를 잡은 적 없는데 `completeLease`가
   * 남의 job을 덮고, 생성이 실패하면 `failLease`가 정상 캐시된 done job을
   * failed로 바꿔 그 해시를 기다리던 사람 전원이 캐시를 잃는다.
   *
   * 예약은 성공했을 때만 반납한다. 흘러들 때는 그대로 들고 가야 생성 구간의
   * `commitQuota`와 짝이 맞는다.
   */
  if (lease.result === 'done') {
    const node = lease.qnodeId ? await loadNode(lease.qnodeId) : null

    if (node) {
      await releaseQuota(input.quotaKey)
      await ensureEdge(input.parentNodeId, node.id)
      await recordEvent({
        parentNodeId: input.parentNodeId,
        rawInput,
        verdict: 'accepted',
        resultingNodeId: node.id,
        matchedNodeId: node.id,
        matchedVia: 'lease',
        gateVersion: NORMALIZER_VERSION,
      })
      return {
        kind: 'ok',
        node,
        cache: 'hit',
        quota: await snapshot(input.quotaKey, input.dailyLimit),
      }
    }

    // 죽은 리스를 비워 다음 사람이 새로 잡게 한다. 안 비우면 여기 계속 걸린다
    await failLease(hash)
    lease = await acquireLease(hash)

    if (lease.result === 'busy') {
      await releaseQuota(input.quotaKey)
      return { kind: 'busy' }
    }

    /*
     * 비운 사이에 누가 정상으로 끝냈으면 그것을 쓴다.
     *
     * 안 보면 방금 생긴 캐시를 무시하고 다시 만든다. 가드를 `done` 전체로
     * 넓히면서 이 블록에 들어오는 빈도가 늘었으니 그만큼 자주 낭비된다.
     * 손상은 아니지만 LLM 한 번이다.
     */
    if (lease.result === 'done' && lease.qnodeId) {
      const fresh = await loadNode(lease.qnodeId)
      if (fresh) {
        await releaseQuota(input.quotaKey)
        await ensureEdge(input.parentNodeId, fresh.id)
        await recordEvent({
          parentNodeId: input.parentNodeId,
          rawInput,
          verdict: 'accepted',
          resultingNodeId: fresh.id,
          matchedNodeId: fresh.id,
          matchedVia: 'lease',
          gateVersion: NORMALIZER_VERSION,
        })
        return {
          kind: 'ok',
          node: fresh,
          cache: 'hit',
          quota: await snapshot(input.quotaKey, input.dailyLimit),
        }
      }
    }
  }

  if (lease.result === 'busy') {
    await releaseQuota(input.quotaKey)
    return { kind: 'busy' }
  }

  // ── 8. 생성 (DB 트랜잭션 밖) ──────────────────────────────
  let content: { body: string; suggestions: string[] }
  try {
    const made = await generateNodeContent({
      question: normalizedQuestion,
      identityScope,
      parentQuestion: parent.question,
      call: input.call,
    })
    content = made

    /*
     * 남은 지적을 로그로 남긴다.
     *
     * 화면에는 안 쓴다. 사용자에게 "이 해설은 규칙을 어겼습니다"라고 알릴
     * 이유가 없다. 대신 우리가 비율을 볼 수 있어야 한다 — 모델을 바꾸거나
     * 프롬프트를 고쳤을 때 좋아졌는지 나빠졌는지는 세어야만 안다.
     *
     * DB 이벤트가 아니라 런타임 로그로 둔다. 스키마를 늘리지 않고도
     * Vercel 로그에서 `rule-miss`로 긁을 수 있다.
     */
    if (made.issues.length > 0) {
      console.warn(
        `rule-miss node=${hash} retried=${made.retried} ${made.issues.map((i) => i.rule).join(',')}`,
      )
    }
  } catch {
    await failLease(hash)
    await releaseQuota(input.quotaKey)
    await recordEvent({
      parentNodeId: input.parentNodeId,
      rawInput,
      verdict: 'error',
      candidateIds,
      gateVersion: NORMALIZER_VERSION,
    })
    return { kind: 'generation_failed' }
  }

  // ── 9. 확정 ──────────────────────────────────────────────
  let nodeId: string
  try {
    nodeId = await insertNode({
      identityScope,
      normalizedQuestion,
      body: content.body,
      primaryCategory: parent.primaryCategory,
      status: 'ready',
      origin: 'on_demand',
    })
  } catch {
    await failLease(hash)
    await releaseQuota(input.quotaKey)
    return { kind: 'generation_failed' }
  }

  await bindAlias(NORMALIZER_VERSION, hash, nodeId)
  await insertSuggestions(nodeId, content.suggestions)
  await ensureEdge(input.parentNodeId, nodeId)
  await completeLease(hash, nodeId)
  await commitQuota(input.quotaKey)
  await recordEvent({
    parentNodeId: input.parentNodeId,
    rawInput,
    verdict: 'accepted',
    resultingNodeId: nodeId,
    candidateIds,
    gateVersion: NORMALIZER_VERSION,
  })

  const node = await loadNode(nodeId)
  if (!node) return { kind: 'generation_failed' }

  return {
    kind: 'ok',
    node,
    cache: 'miss',
    quota: await snapshot(input.quotaKey, input.dailyLimit),
  }
}
