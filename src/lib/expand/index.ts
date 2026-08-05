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

export async function expand(input: ExpandInput): Promise<ExpandOutcome> {
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
        return { kind: 'ancestor_jump', ancestorIndex: hit, nodeId: sug.targetNodeId }
      }
      const node = await loadNode(sug.targetNodeId)
      if (!node) return { kind: 'not_found', what: 'suggestion' }
      await ensureEdge(input.parentNodeId, node.id)
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

  if (lease.result === 'done' && lease.qnodeId) {
    await releaseQuota(input.quotaKey)
    const node = await loadNode(lease.qnodeId)
    if (node) {
      await ensureEdge(input.parentNodeId, node.id)
      return {
        kind: 'ok',
        node,
        cache: 'hit',
        quota: await snapshot(input.quotaKey, input.dailyLimit),
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
    content = await generateNodeContent({
      question: normalizedQuestion,
      identityScope,
      parentQuestion: parent.question,
      call: input.call,
    })
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
