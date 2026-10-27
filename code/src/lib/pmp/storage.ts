import { isPmpLesson, pmpQuestions } from './questions'
export const PMP_KEY = 'pmp-pathfinder-v1'
export const PMP_EVENT = 'pathfinder-pmp-updated'
type Bag = Record<string, unknown>
export type PmpData = Bag & { version: 1 }
const bag = (x: unknown): x is Bag =>
  !!x && typeof x === 'object' && !Array.isArray(x)
export function readPmp(raw: string | null): PmpData {
  if (raw === null) return { version: 1 }
  const value: unknown = JSON.parse(raw)
  if (!bag(value) || value.version !== 1)
    throw Error('기존 PMP 기록 형식을 확인할 수 없어 덮어쓰지 않았어요.')
  return value as PmpData
}
export function pmpField(data: PmpData, field: string): Bag {
  return bag(data[field]) ? (data[field] as Bag) : {}
}
export function pmpText(data: PmpData, field: string, id: string): string {
  const value = pmpField(data, field)[id]
  return typeof value === 'string' ? value : ''
}
export type PmpChange =
  | { kind: 'visit'; id: string }
  | {
      kind: 'text'
      id: string
      field: 'notes' | 'thoughts'
      text: string
      expected: string
    }
  | { kind: 'answer'; id: string; index: number }
  | { kind: 'retry'; id: string }
  | { kind: 'rating'; id: string; rating: 'again' | 'hard' | 'good' }
export function changePmp(
  data: PmpData,
  change: PmpChange,
  now = new Date(),
): PmpData {
  const question = pmpQuestions.get(change.id)
  if (!question) throw Error('알 수 없는 PMP 항목이에요.')
  const next = { ...data },
    at = now.toISOString()
  const write = (field: string, value: unknown) => {
    if (data[field] !== undefined && !bag(data[field]))
      throw Error('기존 기록이 손상되어 수정하지 않았어요.')
    next[field] = { ...pmpField(data, field), [change.id]: value }
  }
  if (change.kind === 'text') {
    if (!isPmpLesson(change.id) || change.text.length > 12000)
      throw Error('메모는 수업별 12,000자까지 저장할 수 있어요.')
    const current = pmpText(data, change.field, change.id)
    if (current !== change.expected && current !== change.text)
      throw Error(
        '다른 탭에서 같은 메모가 바뀌었어요. 입력한 글은 남아 있으니 복사한 뒤 새로고침해 비교해 주세요.',
      )
    write(change.field, change.text)
  } else if (change.kind === 'visit') {
    if (!isPmpLesson(change.id)) throw Error('수업 방문 기록이 아니에요.')
    write('seen', at)
    if (data.journey !== undefined && !Array.isArray(data.journey))
      throw Error('기존 이동 기록을 확인할 수 없어 보존했어요.')
    const journey = (data.journey as unknown[] | undefined) ?? [],
      last = journey.at(-1)
    if (!bag(last) || last.id !== change.id)
      next.journey = [
        ...journey,
        {
          id: change.id,
          from: bag(last) && isPmpLesson(String(last.id)) ? last.id : null,
          at,
        },
      ].slice(-5000)
  } else if (change.kind === 'answer') {
    const option = question.options[change.index]
    if (!Number.isInteger(change.index) || !option)
      throw Error('선택지를 확인해 주세요.')
    write('answers', { index: change.index, correct: option.correct, at })
    if (data.review !== undefined && !bag(data.review))
      throw Error('기존 복습 기록을 확인할 수 없어 보존했어요.')
    if (!option.correct)
      next.review = {
        ...pmpField(data, 'review'),
        [question.node]: { due: at, interval: 0, rating: '오답' },
      }
  } else if (change.kind === 'retry') {
    if (data.answers !== undefined && !bag(data.answers))
      throw Error('기존 답 기록을 확인할 수 없어 보존했어요.')
    const answers = { ...pmpField(data, 'answers') }
    delete answers[change.id]
    next.answers = answers
  } else {
    const interval = { again: 1 / 1440, hard: 1, good: 3 }[change.rating]
    write('recall', change.rating)
    write('review', {
      due: new Date(now.getTime() + interval * 86400000).toISOString(),
      interval,
      rating: change.rating,
    })
  }
  return next
}
export function savePmp(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  change: PmpChange,
): PmpData {
  // Re-read at every edit; do not rewrite a stale page-wide snapshot.
  const next = changePmp(readPmp(storage.getItem(PMP_KEY)), change)
  storage.setItem(PMP_KEY, JSON.stringify(next))
  return next
}
