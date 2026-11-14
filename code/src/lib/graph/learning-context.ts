import type { MapData, MapNode } from '@/lib/db/graph'
import { buildGraphNeighborIndex, type GraphNeighbor } from '@/lib/graph/relations'
import { JOURNEY_STORAGE_KEY, deserializeJourney } from '@/lib/journey/storage'
import { STREAK_STORAGE_KEY, deserializeStreak } from '@/lib/streak/storage'
import {
  ANSWER_PRACTICE_STORAGE_KEY,
  LEGACY_ANSWER_PRACTICE_STORAGE_KEY,
  deserializeAnswerPractice,
} from '@/lib/answer-practice/storage'

export type KnowledgeRecords = {
  status: 'ready' | 'partial' | 'unavailable'
  readIds: string[]
  answeredIds: string[]
  needsReviewIds: string[]
  lastOpenedOn: Record<string, string>
}

export function emptyKnowledgeRecords(status: KnowledgeRecords['status'] = 'ready'): KnowledgeRecords {
  return { status, readIds: [], answeredIds: [], needsReviewIds: [], lastOpenedOn: {} }
}

/** Read existing records only. No migration, write, answer text, or network call. */
export function readKnowledgeRecords(storage: Pick<Storage, 'getItem'>): KnowledgeRecords {
  let failures = 0
  let successfulReads = 0
  const read = (key: string) => {
    try {
      const raw = storage.getItem(key)
      successfulReads += 1
      return raw
    } catch {
      failures += 1
      return null
    }
  }
  const readableVersion = (raw: string | null, versions: number[], field: string) => {
    if (!raw) return true
    try {
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false
      const value = parsed as Record<string, unknown>
      return versions.includes(typeof value.version === 'number' ? value.version : -1)
        && typeof value[field] === 'object' && value[field] !== null && !Array.isArray(value[field])
    } catch {
      return false
    }
  }

  const journeyRaw = read(JOURNEY_STORAGE_KEY)
  const streakRaw = read(STREAK_STORAGE_KEY)
  const currentAnswers = read(ANSWER_PRACTICE_STORAGE_KEY)
  const answersRaw = currentAnswers || read(LEGACY_ANSWER_PRACTICE_STORAGE_KEY)
  const journey = deserializeJourney(journeyRaw)
  if (journeyRaw && !journey) failures += 1
  if (!readableVersion(streakRaw, [1], 'days')) failures += 1
  if (!readableVersion(answersRaw, [1, 2], 'drafts')) failures += 1

  const streak = deserializeStreak(streakRaw)
  const answers = deserializeAnswerPractice(answersRaw)
  const readIds = new Set(journey?.occurrences.map((occurrence) => occurrence.nodeId) ?? [])
  const lastOpenedOn: Record<string, string> = {}
  for (const [day, ids] of Object.entries(streak.days)) {
    for (const id of ids) {
      readIds.add(id)
      if (!lastOpenedOn[id] || lastOpenedOn[id] < day) lastOpenedOn[id] = day
    }
  }
  const answeredIds = new Set<string>()
  for (const [id, draft] of Object.entries(answers.drafts)) {
    if (draft.text.trim()) answeredIds.add(id)
  }
  for (const ids of Object.values(answers.practiceDays)) {
    for (const id of ids) answeredIds.add(id)
  }
  for (const id of Object.keys(answers.reviews)) answeredIds.add(id)

  return {
    status: successfulReads === 0 ? 'unavailable' : failures ? 'partial' : 'ready',
    readIds: [...readIds],
    answeredIds: [...answeredIds],
    needsReviewIds: Object.entries(answers.reviews)
      .filter(([, review]) => review.status === 'needs-review')
      .map(([id]) => id),
    lastOpenedOn,
  }
}

export type KnowledgeQuestion = MapNode & {
  read: boolean
  answered: boolean
  needsReview: boolean
  lastOpenedOn?: string
}

export type KnowledgeConnection = {
  from: KnowledgeQuestion
  to: KnowledgeQuestion
  kind: GraphNeighbor['kind']
  relationKind?: GraphNeighbor['relationKind']
  relationDirection?: GraphNeighbor['relationDirection']
  reason?: string
}

export type NextKnowledgeConnection = {
  node: MapNode
  anchors: Array<{ node: KnowledgeQuestion; relation: GraphNeighbor }>
}

export type KnowledgeContext = {
  questions: KnowledgeQuestion[]
  connections: KnowledgeConnection[]
  next: NextKnowledgeConnection[]
  readCount: number
  answeredCount: number
  categories: Array<{ name: string; count: number }>
}

/**
 * Join local IDs with the public map before rendering any private record metadata.
 * Build adjacency once: O(V + E + R), apart from presentation sorting. A click or
 * draft is a record, never a claim that a concept is understood.
 */
export function deriveKnowledgeContext(data: MapData, records: KnowledgeRecords): KnowledgeContext {
  const readIds = new Set(records.readIds)
  const answeredIds = new Set(records.answeredIds)
  const needsReviewIds = new Set(records.needsReviewIds)
  const questions = data.nodes
    .filter((node) => readIds.has(node.id) || answeredIds.has(node.id))
    .map((node): KnowledgeQuestion => ({
      ...node,
      read: readIds.has(node.id),
      answered: answeredIds.has(node.id),
      needsReview: needsReviewIds.has(node.id),
      lastOpenedOn: records.lastOpenedOn[node.id],
    }))
    .sort((a, b) => (b.lastOpenedOn ?? '').localeCompare(a.lastOpenedOn ?? '')
      || a.question.localeCompare(b.question, 'ko'))
  const recorded = new Map(questions.map((node) => [node.id, node]))
  const publicNodes = new Map(data.nodes.map((node) => [node.id, node]))
  const neighbors = buildGraphNeighborIndex(data)
  const connections: KnowledgeConnection[] = []
  const nextById = new Map<string, NextKnowledgeConnection>()
  const pairs = new Set<string>()

  for (const node of questions) {
    for (const relation of neighbors.get(node.id) ?? []) {
      const other = recorded.get(relation.id)
      if (other) {
        const pair = [node.id, other.id].sort().join('::')
        if (pairs.has(pair)) continue
        pairs.add(pair)
        const incoming = relation.direction === 'incoming'
        connections.push({
          from: incoming ? other : node,
          to: incoming ? node : other,
          kind: relation.kind,
          relationKind: relation.relationKind,
          relationDirection: relation.relationDirection,
          reason: relation.reason,
        })
      } else {
        const target = publicNodes.get(relation.id)
        if (!target) continue
        const candidate = nextById.get(target.id) ?? { node: target, anchors: [] }
        candidate.anchors.push({ node, relation })
        nextById.set(target.id, candidate)
      }
    }
  }

  const categoryCounts = new Map<string, number>()
  for (const node of questions) categoryCounts.set(node.category, (categoryCounts.get(node.category) ?? 0) + 1)
  return {
    questions,
    connections,
    // More recorded anchors gives context to resume, not a mastery/priority score.
    next: [...nextById.values()].sort((a, b) => b.anchors.length - a.anchors.length
      || a.node.question.localeCompare(b.node.question, 'ko')),
    readCount: questions.filter((node) => node.read).length,
    answeredCount: questions.filter((node) => node.answered).length,
    categories: [...categoryCounts].map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
  }
}

function markdownText(text: string): string {
  return text.replace(/[\r\n\u0000]+/g, ' ').replace(/([\\`*_{}\[\]()#+.!|<>~-])/g, '\\$1')
}

/** A user-requested local document; contains public text and record flags, no answers. */
export function formatKnowledgeMarkdown(
  context: KnowledgeContext,
  { origin, generatedAt }: { origin: string; generatedAt: string },
): string {
  const base = new URL(origin)
  if (base.protocol !== 'https:' && base.protocol !== 'http:') throw new Error('Unsupported link origin')
  const created = new Date(generatedAt)
  if (Number.isNaN(created.getTime())) throw new Error('Invalid creation date')
  const link = (node: MapNode) => {
    const id = encodeURIComponent(node.id).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    return `[${markdownText(node.question)}](${base.origin}/q/${id})`
  }
  const status = (node: KnowledgeQuestion) => [node.read ? '열어 봄' : '', node.answered ? '답변 기록' : '', node.needsReview ? '다시 볼 표시' : ''].filter(Boolean).join(' · ')
  const relationLabel = (connection: Pick<KnowledgeConnection, 'kind' | 'relationKind' | 'relationDirection'>) => {
    const reviewed = connection.relationDirection === 'forward' || connection.relationDirection === 'reverse'
    if (connection.relationKind === 'prerequisite' && !reviewed) return '선후 관계 · 방향 미확인'
    if (connection.relationKind === 'instance_of' && !reviewed) return '개념·예시 관계 · 방향 미확인'
    switch (connection.relationKind) {
      case 'prerequisite': return '바탕 질문 → 이어지는 질문'
      case 'instance_of': return '개념 → 예시'
      case 'alternative': return '대안 비교'
      case 'shares_concept': return '공유하는 개념'
      default: return connection.kind === 'walked' ? '질문 이동 연결' : '연관 관계 · 방향 미지정'
    }
  }
  const lines = [
    '# CS Pathfinder 연결 정리', '',
    `생성 시각: ${created.toISOString()}`, `링크 기준: ${base.origin}`, '',
    '이 브라우저의 공개 질문 읽기·답변 기록을 지도와 함께 정리한 문서입니다.',
    '읽음·답변 표시는 이해도 평가가 아닙니다. 추정된 관계는 틀릴 수 있습니다.',
    '방향을 확인하지 않은 관계는 선행 학습이나 예시 순서로 안내하지 않습니다.',
    '개인 답변 본문은 포함하지 않지만 학습 표시가 들어 있으니 공유 전에 확인해 주세요.', '',
    `열어 본 질문 ${context.readCount}개 · 답변 기록 ${context.answeredCount}개 · 기록 사이 연결 ${context.connections.length}개`, '',
    '## 기록한 질문', '',
  ]
  for (const node of context.questions) lines.push(`- ${link(node)} — ${markdownText(node.category)} · ${status(node)}`)
  if (!context.questions.length) lines.push('공개 지도와 연결되는 기록이 없습니다.')
  lines.push('', '## 기록 사이의 연결', '')
  for (const connection of context.connections) {
    const reviewed = connection.relationDirection === 'forward' || connection.relationDirection === 'reverse'
    const directed = connection.kind === 'walked' || reviewed && (connection.relationKind === 'prerequisite' || connection.relationKind === 'instance_of')
    lines.push(`- ${link(connection.from)} ${directed ? '→' : '↔'} ${link(connection.to)} — ${relationLabel(connection)}`)
    if (connection.reason) lines.push(`  - 연결 이유: ${markdownText(connection.reason)}`)
  }
  if (!context.connections.length) lines.push('공개 지도에 표시된 기록 사이 연결이 없습니다. 학습 완료나 부족을 뜻하지 않습니다.')
  lines.push('', '## 기록한 질문과 연결된 질문', '')
  for (const candidate of context.next) {
    lines.push(`- ${link(candidate.node)} — ${markdownText(candidate.node.category)}`)
    for (const anchor of candidate.anchors) {
      const relation = anchor.relation
      const direction = relation.direction === 'incoming' ? '후보 → 기록 질문' : relation.direction === 'outgoing' ? '기록 질문 → 후보' : '방향 미지정'
      lines.push(`  - 기록한 질문: ${link(anchor.node)} · ${relationLabel(relation)} · ${direction}`)
      if (relation.reason) lines.push(`    - 연결 이유: ${markdownText(relation.reason)}`)
    }
  }
  if (!context.next.length) lines.push('공개 지도에서 새로 이어갈 질문을 찾지 못했습니다.')
  return `${lines.join('\n')}\n`
}
