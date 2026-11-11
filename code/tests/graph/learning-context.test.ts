import { describe, expect, it, vi } from 'vitest'
import type { MapData } from '@/lib/db/graph'
import { deriveKnowledgeContext, emptyKnowledgeRecords, formatKnowledgeMarkdown, readKnowledgeRecords } from '@/lib/graph/learning-context'
import { JOURNEY_STORAGE_KEY, serializeJourney } from '@/lib/journey/storage'
import { STREAK_STORAGE_KEY, serializeStreak } from '@/lib/streak/storage'
import {
  ANSWER_PRACTICE_STORAGE_KEY,
  LEGACY_ANSWER_PRACTICE_STORAGE_KEY,
  emptyAnswerPractice,
  markAnswerReview,
  serializeAnswerPractice,
  updateAnswerDraft,
} from '@/lib/answer-practice/storage'

const data: MapData = {
  nodes: [
    { id: 'transaction', question: '트랜잭션이란?', category: '데이터베이스' },
    { id: 'lock', question: '락은 언제 필요한가?', category: '데이터베이스' },
    { id: 'pool', question: '연결풀을 쓰는 이유는?', category: '운영체제' },
    { id: 'mvcc', question: 'MVCC의 역할은?', category: '데이터베이스' },
  ],
  edges: [
    { parentId: 'transaction', childId: 'lock', kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', reason: '선행 관계를 검토' },
    { parentId: 'lock', childId: 'pool', kind: 'related', relationKind: 'shares_concept', reason: '자원 대기와 연결' },
    { parentId: 'transaction', childId: 'mvcc', kind: 'related', relationKind: 'instance_of', relationDirection: 'forward', reason: '예시 관계를 검토' },
  ],
}

function storageOf(entries: Record<string, string>) {
  const getItem = vi.fn((key: string) => entries[key] ?? null)
  return { getItem }
}

describe('existing local knowledge records', () => {
  it('unions historical journey, read days and retained answer/review IDs without writing or exposing answer text', () => {
    let answers = updateAnswerDraft(emptyAnswerPractice(), 'pool', 'private synthetic answer', '2026-11-10T00:00:00Z')
    answers = markAnswerReview(answers, 'pool', 'needs-review', '2026-11-10T00:00:00Z')
    answers = { ...answers, drafts: {} } // old review survives draft pruning
    const entries = {
      [JOURNEY_STORAGE_KEY]: serializeJourney({ occurrences: [
        { id: 'o1', nodeId: 'transaction', parentId: null, question: 'old question label', category: 'old category' },
      ], currentId: 'o1' }),
      [STREAK_STORAGE_KEY]: serializeStreak({ days: { '2026-11-09': ['lock'], '2026-11-10': ['lock', 'unknown-private-id'] } }),
      [ANSWER_PRACTICE_STORAGE_KEY]: serializeAnswerPractice(answers),
    }
    const before = JSON.stringify(entries)
    const records = readKnowledgeRecords(storageOf(entries))
    expect(records.status).toBe('ready')
    expect(new Set(records.readIds)).toEqual(new Set(['transaction', 'lock', 'unknown-private-id']))
    expect(records.answeredIds).toEqual(['pool'])
    expect(records.needsReviewIds).toEqual(['pool'])
    expect(records.lastOpenedOn.lock).toBe('2026-11-10')
    expect(JSON.stringify(records)).not.toContain('private synthetic answer')
    expect(JSON.stringify(entries)).toBe(before)
  })

  it('reads version-one answers as a view without persisting a migration', () => {
    const raw = JSON.stringify({ version: 1, alwaysOpen: false, drafts: {
      lock: { text: 'legacy synthetic answer', updatedAt: '2026-11-10T00:00:00Z', reviewStatus: 'needs-review', reviewedAt: '2026-11-10T00:00:00Z' },
    } })
    const storage = storageOf({ [LEGACY_ANSWER_PRACTICE_STORAGE_KEY]: raw })
    const records = readKnowledgeRecords(storage)
    expect(records.answeredIds).toEqual(['lock'])
    expect(records.needsReviewIds).toEqual(['lock'])
    expect(storage.getItem).toHaveBeenCalledWith(LEGACY_ANSWER_PRACTICE_STORAGE_KEY)
  })

  it('preserves valid independent records when one record is malformed or unsupported', () => {
    for (const invalid of ['{broken', JSON.stringify({ version: 8, drafts: {} }), JSON.stringify({ version: 2 })]) {
      const records = readKnowledgeRecords(storageOf({
        [STREAK_STORAGE_KEY]: serializeStreak({ days: { '2026-11-10': ['lock'] } }),
        [ANSWER_PRACTICE_STORAGE_KEY]: invalid,
      }))
      expect(records.status).toBe('partial')
      expect(records.readIds).toEqual(['lock'])
      expect(records.answeredIds).toEqual([])
    }
  })

  it('does not turn blocked access into an empty successful history', () => {
    const records = readKnowledgeRecords({ getItem: () => { throw new DOMException('blocked', 'SecurityError') } })
    expect(records).toEqual(emptyKnowledgeRecords('unavailable'))
  })
})

describe('public-map knowledge context', () => {
  it('joins only public IDs, distinguishes read/answer records and retains prerequisite direction from a reverse visit', () => {
    const records = { ...emptyKnowledgeRecords(), readIds: ['lock', 'transaction', 'private-id'], answeredIds: ['pool', 'secret-id'], needsReviewIds: ['pool'], lastOpenedOn: { lock: '2026-11-10' } }
    const result = deriveKnowledgeContext(data, records)
    expect(result.questions.map((node) => node.id)).toEqual(['lock', 'pool', 'transaction'])
    expect(result.readCount).toBe(2)
    expect(result.answeredCount).toBe(1)
    expect(result.questions.find((node) => node.id === 'pool')).toMatchObject({ read: false, answered: true, needsReview: true })
    const prerequisite = result.connections.find((connection) => connection.relationKind === 'prerequisite')!
    expect(prerequisite.from.id).toBe('transaction')
    expect(prerequisite.to.id).toBe('lock')
    expect(JSON.stringify(result)).not.toMatch(/private-id|secret-id/)
    expect(result.categories).toEqual([{ name: '데이터베이스', count: 2 }, { name: '운영체제', count: 1 }])
  })

  it('deduplicates an unread neighbor while retaining every recorded anchor and typed reason', () => {
    const extra: MapData = { ...data, edges: [...data.edges,
      { parentId: 'pool', childId: 'mvcc', kind: 'related', relationKind: 'shares_concept', reason: 'another context' },
      { parentId: 'pool', childId: 'missing', kind: 'related', relationKind: 'alternative' },
    ] }
    const result = deriveKnowledgeContext(extra, { ...emptyKnowledgeRecords(), readIds: ['transaction', 'pool'] })
    const candidate = result.next.find((next) => next.node.id === 'mvcc')!
    expect(candidate.anchors).toHaveLength(2)
    expect(candidate.anchors.find((anchor) => anchor.node.id === 'transaction')?.relation).toMatchObject({ relationKind: 'instance_of', direction: 'outgoing', reason: '예시 관계를 검토' })
    expect(result.next.some((candidate) => candidate.node.id === 'missing')).toBe(false)
    expect(result.next.filter((candidate) => candidate.node.id === 'mvcc')).toHaveLength(1)
  })

  it('keeps unreviewed directed metadata neutral in recorded pairs, neighbor labels and exported order', () => {
    const unreviewed: MapData = { ...data, edges: data.edges.map(({ relationDirection: _review, ...edge }) => edge) }
    const records = { ...emptyKnowledgeRecords(), readIds: ['transaction', 'lock'] }
    const result = deriveKnowledgeContext(unreviewed, records)
    expect(result.connections[0]).toMatchObject({ relationKind: 'prerequisite', relationDirection: 'unreviewed' })
    expect(result.next.find((candidate) => candidate.node.id === 'mvcc')?.anchors[0].relation).toMatchObject({ relationKind: 'instance_of', relationDirection: 'unreviewed', direction: 'undirected' })
    const markdown = formatKnowledgeMarkdown(result, { origin: 'https://example.test', generatedAt: '2026-11-11' })
    expect(markdown).toContain('선후 관계 · 방향 미확인')
    expect(markdown).toContain('개념·예시 관계 · 방향 미확인')
    expect(markdown).toContain('방향 미지정')
    expect(markdown).toContain(' ↔ ')
    expect(markdown).not.toContain('바탕 질문 → 이어지는 질문')
    expect(markdown).not.toContain('개념 → 예시')
  })

  it('carries a reviewed reverse direction into normalized recorded and exported orientation', () => {
    const reverse: MapData = { ...data, edges: [{ parentId: 'lock', childId: 'transaction', kind: 'related', relationKind: 'prerequisite', relationDirection: 'reverse', reason: '트랜잭션부터 검토' }] }
    const result = deriveKnowledgeContext(reverse, { ...emptyKnowledgeRecords(), readIds: ['transaction', 'lock'] })
    expect(result.connections[0]).toMatchObject({ from: { id: 'transaction' }, to: { id: 'lock' }, relationDirection: 'reverse' })
    const markdown = formatKnowledgeMarkdown(result, { origin: 'https://example.test', generatedAt: '2026-11-11' })
    expect(markdown).toContain('[트랜잭션이란?](https://example.test/q/transaction) → [락은 언제 필요한가?](https://example.test/q/lock)')
  })

  it('does not invent edges or mastery for isolated records', () => {
    const result = deriveKnowledgeContext({ ...data, edges: [] }, { ...emptyKnowledgeRecords(), readIds: ['lock'] })
    expect(result.questions).toHaveLength(1)
    expect(result.connections).toEqual([])
    expect(result.next).toEqual([])
    expect(JSON.stringify(result)).not.toMatch(/mastered|understood/)
  })

  it('does not mutate map, existing IDs, or record arrays', () => {
    const records = { ...emptyKnowledgeRecords(), readIds: ['transaction', 'lock'] }
    const before = JSON.stringify({ data, records })
    deriveKnowledgeContext(data, records)
    expect(JSON.stringify({ data, records })).toBe(before)
  })
})

describe('local Markdown connection export', () => {
  it('exports joined public questions and semantic direction without private records', () => {
    const context = deriveKnowledgeContext(data, { ...emptyKnowledgeRecords(), readIds: ['lock', 'transaction', 'private-id'], answeredIds: ['lock'] })
    const markdown = formatKnowledgeMarkdown(context, { origin: 'https://example.test/ignored-path', generatedAt: '2026-11-11T14:00:00Z' })
    expect(markdown).toContain('[트랜잭션이란?](https://example.test/q/transaction) → [락은 언제 필요한가?](https://example.test/q/lock)')
    expect(markdown).toContain('선행 관계를 검토')
    expect(markdown).toContain('2026-11-11T14:00:00.000Z')
    expect(markdown).toContain('읽음·답변 표시는 이해도 평가가 아닙니다')
    expect(markdown).toContain('## 기록한 질문과 연결된 질문')
    expect(markdown).not.toContain('private-id')
  })

  it('escapes content as text and never invents direction for legacy links', () => {
    const map: MapData = { nodes: [
      { id: 'a) [x]', question: '[링크](javascript:bad)\n<script>', category: '*분야*' },
      { id: 'b', question: '두 번째', category: '분야' },
    ], edges: [{ parentId: 'a) [x]', childId: 'b', kind: 'related', reason: '# 새 제목\n> 외부 내용' }] }
    const context = deriveKnowledgeContext(map, { ...emptyKnowledgeRecords(), readIds: ['a) [x]', 'b'] })
    const markdown = formatKnowledgeMarkdown(context, { origin: 'http://127.0.0.1:3046', generatedAt: '2026-11-11' })
    expect(markdown).toContain('\\[링크\\]\\(javascript:bad\\) \\<script\\>')
    expect(markdown).toContain('연관 관계 · 방향 미지정')
    expect(markdown).toContain('/q/a%29%20%5Bx%5D')
    expect(markdown).toContain(' ↔ ')
    expect(markdown).not.toContain('\n# 새 제목')
    expect(() => formatKnowledgeMarkdown(context, { origin: 'javascript:alert(1)', generatedAt: '2026-11-11' })).toThrow()
    expect(() => formatKnowledgeMarkdown(context, { origin: 'https://example.test', generatedAt: 'bad' })).toThrow()
  })
})
