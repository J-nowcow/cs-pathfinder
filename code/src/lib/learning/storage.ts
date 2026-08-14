import type { DailyLearningItem, DailySessionSnapshot } from '@/lib/learning/session'

export const DAILY_LEARNING_STORAGE_KEY = 'csqt.daily-learning.v1'
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/

function shortText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function readItem(value: unknown): DailyLearningItem | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (item.kind !== 'review' && item.kind !== 'new') return null
  if (!shortText(item.questionId, 200) || !shortText(item.question, 500) || !shortText(item.reason, 200)) return null
  if (item.completedAt !== undefined && !shortText(item.completedAt, 50)) return null
  return {
    kind: item.kind,
    questionId: item.questionId,
    question: item.question,
    reason: item.reason,
    ...(item.completedAt ? { completedAt: item.completedAt } : {}),
  }
}

/** 손상되거나 임의로 커진 localStorage 값을 학습 화면으로 넘기지 않는다. */
export function deserializeDailySession(raw: string | null): DailySessionSnapshot | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Record<string, unknown>
    if (!value || typeof value !== 'object') return null
    if (typeof value.date !== 'string' || !DATE_SHAPE.test(value.date)) return null
    if (!shortText(value.trackId, 100) || !shortText(value.createdAt, 50)) return null
    if (!Array.isArray(value.items) || value.items.length > 3) return null
    const items = value.items.map(readItem)
    if (items.some((item) => item === null)) return null
    const safeItems = items as DailyLearningItem[]
    if (new Set(safeItems.map((item) => item.questionId)).size !== safeItems.length) return null
    return { date: value.date, trackId: value.trackId, createdAt: value.createdAt, items: safeItems }
  } catch {
    return null
  }
}

export function loadDailySession(): DailySessionSnapshot | null {
  try {
    return deserializeDailySession(window.localStorage.getItem(DAILY_LEARNING_STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveDailySession(snapshot: DailySessionSnapshot): boolean {
  try {
    window.localStorage.setItem(DAILY_LEARNING_STORAGE_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    return false
  }
}
