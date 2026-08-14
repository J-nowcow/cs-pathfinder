import { kstToday } from '@/lib/daily/date'
import { shiftDay } from '@/lib/streak/storage'

export const ANSWER_PRACTICE_STORAGE_KEY = 'csqt.answer-practice.v2'
export const LEGACY_ANSWER_PRACTICE_STORAGE_KEY = 'csqt.answer-practice.v1'
export const MAX_ANSWER_LENGTH = 6000
export const MAX_ANSWER_DRAFTS = 100
export const MAX_ANSWER_REVIEWS = 500
export const MAX_PRACTICE_DAYS = 400
export const MAX_PRACTICE_PER_DAY = 200

export type AnswerReviewStatus = 'needs-review' | 'understood'
export type AnswerDraft = {
  text: string
  updatedAt: string
}
export type AnswerReview = {
  status: AnswerReviewStatus
  reviewedAt: string
  nextReviewOn: string
  reviewCount: number
  successStreak: number
}
export type AnswerPracticeState = {
  alwaysOpen: boolean
  drafts: Record<string, AnswerDraft>
  reviews: Record<string, AnswerReview>
  practiceDays: Record<string, string[]>
}

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/

export function emptyAnswerPractice(): AnswerPracticeState {
  return { alwaysOpen: false, drafts: {}, reviews: {}, practiceDays: {} }
}

function validNodeId(nodeId: string): boolean {
  return nodeId.length > 0 && nodeId.length <= 200
}

function validDay(day: string): boolean {
  if (!DATE_SHAPE.test(day)) return false
  const parsed = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day
}

function readDrafts(raw: unknown): Record<string, AnswerDraft> {
  if (typeof raw !== 'object' || !raw) return {}
  const drafts: Record<string, AnswerDraft> = {}
  for (const [nodeId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!validNodeId(nodeId) || typeof value !== 'object' || !value) continue
    const draft = value as Record<string, unknown>
    if (typeof draft.text !== 'string' || typeof draft.updatedAt !== 'string') continue
    drafts[nodeId] = { text: draft.text.slice(0, MAX_ANSWER_LENGTH), updatedAt: draft.updatedAt }
  }
  return Object.fromEntries(
    Object.entries(drafts)
      .sort(([, a], [, b]) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_ANSWER_DRAFTS),
  )
}

function readReviews(raw: unknown): Record<string, AnswerReview> {
  if (typeof raw !== 'object' || !raw) return {}
  const reviews: Record<string, AnswerReview> = {}
  for (const [nodeId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!validNodeId(nodeId) || typeof value !== 'object' || !value) continue
    const review = value as Record<string, unknown>
    if (review.status !== 'needs-review' && review.status !== 'understood') continue
    if (typeof review.reviewedAt !== 'string' || !reviewDay(review.reviewedAt)) continue
    if (!validDay(String(review.nextReviewOn))) continue
    if (!Number.isInteger(review.reviewCount) || Number(review.reviewCount) < 1) continue
    if (!Number.isInteger(review.successStreak) || Number(review.successStreak) < 0) continue
    reviews[nodeId] = {
      status: review.status,
      reviewedAt: review.reviewedAt,
      nextReviewOn: String(review.nextReviewOn),
      reviewCount: Number(review.reviewCount),
      successStreak: Number(review.successStreak),
    }
  }
  return trimReviews(reviews)
}

function readPracticeDays(raw: unknown): Record<string, string[]> {
  if (typeof raw !== 'object' || !raw) return {}
  const days: Record<string, string[]> = {}
  for (const [day, rawIds] of Object.entries(raw as Record<string, unknown>)) {
    if (!validDay(day) || !Array.isArray(rawIds)) continue
    const ids = [
      ...new Set(rawIds.filter((id): id is string => typeof id === 'string' && validNodeId(id))),
    ]
    if (ids.length > 0) days[day] = ids.slice(0, MAX_PRACTICE_PER_DAY)
  }
  return trimPracticeDays(days)
}

function trimReviews(reviews: Record<string, AnswerReview>): Record<string, AnswerReview> {
  return Object.fromEntries(
    Object.entries(reviews)
      .sort(([, a], [, b]) =>
        Number(b.status === 'needs-review') - Number(a.status === 'needs-review')
        || b.reviewedAt.localeCompare(a.reviewedAt),
      )
      .slice(0, MAX_ANSWER_REVIEWS),
  )
}

function trimPracticeDays(days: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(days).sort(([a], [b]) => b.localeCompare(a)).slice(0, MAX_PRACTICE_DAYS),
  )
}

function reviewDay(reviewedAt: string): string | null {
  const instant = new Date(reviewedAt)
  if (Number.isNaN(instant.getTime())) return null
  return kstToday(instant)
}

function recordPracticeDay(
  practiceDays: Record<string, string[]>,
  day: string,
  nodeId: string,
): Record<string, string[]> {
  const ids = practiceDays[day] ?? []
  if (ids.includes(nodeId)) return practiceDays
  return trimPracticeDays({ ...practiceDays, [day]: [...ids, nodeId] })
}

function migrateVersionOne(parsed: Record<string, unknown>): AnswerPracticeState {
  const drafts = readDrafts(parsed.drafts)
  const reviews: Record<string, AnswerReview> = {}
  let practiceDays: Record<string, string[]> = {}
  if (typeof parsed.drafts === 'object' && parsed.drafts) {
    for (const [nodeId, value] of Object.entries(parsed.drafts as Record<string, unknown>)) {
      if (!drafts[nodeId] || typeof value !== 'object' || !value) continue
      const old = value as Record<string, unknown>
      if (old.reviewStatus !== 'needs-review' && old.reviewStatus !== 'understood') continue
      if (typeof old.reviewedAt !== 'string') continue
      const day = reviewDay(old.reviewedAt)
      if (!day) continue
      const understood = old.reviewStatus === 'understood'
      reviews[nodeId] = {
        status: old.reviewStatus,
        reviewedAt: old.reviewedAt,
        nextReviewOn: shiftDay(day, understood ? 7 : 1),
        reviewCount: 1,
        successStreak: understood ? 1 : 0,
      }
      practiceDays = recordPracticeDay(practiceDays, day, nodeId)
    }
  }
  return {
    alwaysOpen: parsed.alwaysOpen === true,
    drafts,
    reviews: trimReviews(reviews),
    practiceDays,
  }
}

/** localStorage는 사용자가 고칠 수 있으므로 유효한 값만 살려 읽는다. */
export function deserializeAnswerPractice(raw: string | null): AnswerPracticeState {
  if (!raw) return emptyAnswerPractice()
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.version === 1) return migrateVersionOne(parsed)
    if (parsed.version !== 2) return emptyAnswerPractice()
    return {
      alwaysOpen: parsed.alwaysOpen === true,
      drafts: readDrafts(parsed.drafts),
      reviews: readReviews(parsed.reviews),
      practiceDays: readPracticeDays(parsed.practiceDays),
    }
  } catch {
    return emptyAnswerPractice()
  }
}

export function serializeAnswerPractice(state: AnswerPracticeState): string {
  return JSON.stringify({ version: 2, ...state })
}

/** 최근 초안만 남긴다. 빈 답은 삭제로 취급하되 복습 일정은 유지한다. */
export function updateAnswerDraft(
  state: AnswerPracticeState,
  nodeId: string,
  text: string,
  updatedAt: string,
): AnswerPracticeState {
  if (!validNodeId(nodeId)) return state
  const drafts = { ...state.drafts }
  const trimmed = text.slice(0, MAX_ANSWER_LENGTH)
  if (trimmed.trim()) drafts[nodeId] = { text: trimmed, updatedAt }
  else delete drafts[nodeId]

  return { ...state, drafts: readDrafts(drafts) }
}

/** 모범답안과 비교한 자기 점검으로 다음 복습일과 학습일을 함께 남긴다. */
export function markAnswerReview(
  state: AnswerPracticeState,
  nodeId: string,
  status: AnswerReviewStatus,
  reviewedAt: string,
): AnswerPracticeState {
  if (!state.drafts[nodeId]) return state
  const day = reviewDay(reviewedAt)
  if (!day) return state
  const previous = state.reviews[nodeId]
  const successStreak = status === 'understood' ? (previous?.successStreak ?? 0) + 1 : 0
  const interval = status === 'needs-review' ? 1 : successStreak === 1 ? 7 : successStreak === 2 ? 30 : 90
  const reviews = trimReviews({
    ...state.reviews,
    [nodeId]: {
      status,
      reviewedAt,
      nextReviewOn: shiftDay(day, interval),
      reviewCount: (previous?.reviewCount ?? 0) + 1,
      successStreak,
    },
  })
  return {
    ...state,
    reviews,
    practiceDays: recordPracticeDay(state.practiceDays, day, nodeId),
  }
}

export function loadAnswerPractice(): AnswerPracticeState {
  try {
    const current = window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY)
    if (current) return deserializeAnswerPractice(current)
    return deserializeAnswerPractice(window.localStorage.getItem(LEGACY_ANSWER_PRACTICE_STORAGE_KEY))
  } catch {
    return emptyAnswerPractice()
  }
}

export function saveAnswerPractice(state: AnswerPracticeState): boolean {
  try {
    window.localStorage.setItem(ANSWER_PRACTICE_STORAGE_KEY, serializeAnswerPractice(state))
    return true
  } catch {
    return false
  }
}
