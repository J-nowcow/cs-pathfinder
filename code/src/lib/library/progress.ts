import { deserializeJourney, JOURNEY_STORAGE_KEY } from '@/lib/journey/storage'
import { deserializeStreak, STREAK_STORAGE_KEY } from '@/lib/streak/storage'
import {
  deserializeAnswerPractice,
  ANSWER_PRACTICE_STORAGE_KEY,
  LEGACY_ANSWER_PRACTICE_STORAGE_KEY,
} from '@/lib/answer-practice/storage'
import { emptyLibrary } from './storage'
import { readLibraryStrict } from './local-edit'
import { kstToday } from '@/lib/daily/date'
import pmp from '../../../data/pmp-library.json'
import jira from '../../../data/jira-library.json'
import { CERTIFICATE_KEY, readCertificate } from '@/lib/certificate/storage'
import { certificateLessons, certificateHref } from '@/lib/certificate/course'
import { pmpLessonHref } from '@/lib/pmp/routes'
export type ProgressItem = {
  id: string
  track: string
  title: string
  href: string
  at: string | null
  due?: string
  excerpt?: string
}
export type ProgressCard = {
  id: string
  title: string
  metrics: Array<[string, number]>
  href: string
  resume: string
}
const stamp = (s: unknown): s is string =>
  typeof s === 'string' && s.length < 50 && Number.isFinite(Date.parse(s))
const nodeId = (s: unknown): s is string =>
  typeof s === 'string' && /^[a-zA-Z0-9-]{1,200}$/.test(s)
const uniqueNumbers = (v: unknown, max: number) =>
  Array.isArray(v)
    ? [...new Set(v.filter((x) => Number.isInteger(x) && x >= 1 && x <= max))]
    : []
export function readLibraryProgress(
  storage: Pick<Storage, 'getItem'>,
  now = new Date(),
) {
  let unavailable = false
  const get = (key: string) => {
    try {
      return storage.getItem(key)
    } catch {
      unavailable = true
      return null
    }
  }
  const object = (raw: string | null): Record<string, unknown> => {
    try {
      if (!raw) return {}
      const p = JSON.parse(raw)
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
    } catch {
      unavailable = true
      return {}
    }
  }
  const journey = deserializeJourney(get(JOURNEY_STORAGE_KEY)),
    streak = deserializeStreak(get(STREAK_STORAGE_KEY)),
    answers = deserializeAnswerPractice(
      get(ANSWER_PRACTICE_STORAGE_KEY) ??
        get(LEGACY_ANSWER_PRACTICE_STORAGE_KEY),
    )
  let library = emptyLibrary()
  try {
    library = readLibraryStrict({ getItem: get })
  } catch {
    unavailable = true
  }
  const titles = new Map(
      (journey?.occurrences ?? [])
        .filter((o) => nodeId(o.nodeId))
        .map((o) => [o.nodeId, o.question.slice(0, 200)]),
    ),
    current = journey?.occurrences.find(
      (o) => o.id === journey.currentId && nodeId(o.nodeId),
    )
  const pRaw = object(get('pmp-pathfinder-v1')),
    p = pRaw.version === 1 ? pRaw : {},
    nodes = new Map(pmp.nodes.map((n) => [n.id, n.title])),
    seen = object(typeof p.seen === 'object' ? JSON.stringify(p.seen) : null),
    reviews = object(
      typeof p.review === 'object' ? JSON.stringify(p.review) : null,
    )
  const pSeen = Object.entries(seen)
    .filter(([id, at]) => nodes.has(id) && stamp(at))
    .map(([id, at]) => ({ id, at: at as string }))
    .sort((a, b) => b.at.localeCompare(a.at))
  const j = object(get('jira-garden-v1')),
    done = uniqueNumbers(j.done, 10),
    solved = uniqueNumbers(j.solved, 20),
    last =
      Number.isInteger(j.last) && Number(j.last) >= 1 && Number(j.last) <= 10
        ? Number(j.last)
        : 1
  const today = kstToday(now)
  const due: ProgressItem[] = [],
    recent: ProgressItem[] = []
  let certificateEntries: ReturnType<typeof readCertificate>['entries'] = {}
  try {
    certificateEntries = readCertificate(get(CERTIFICATE_KEY)).entries
  } catch {
    unavailable = true
  }
  const certificateRecent: ProgressItem[] = Object.entries(certificateEntries)
    .map(([id, e]) => ({
      id: 'certificate:' + id,
      track: '정처기',
      title: certificateLessons.get(id)!.title,
      href: certificateHref(id),
      at: e.visitedAt > e.updatedAt ? e.visitedAt : e.updatedAt,
      ...(e.draft.trim() ? { excerpt: e.draft.trim().slice(0, 180) } : {}),
      ...(e.due ? { due: e.due } : {}),
    }))
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
  recent.push(...certificateRecent)
  due.push(...certificateRecent.filter((e) => e.due && e.due <= today))
  for (const [id, a] of Object.entries(answers.reviews))
    if (nodeId(id) && a.nextReviewOn <= today)
      due.push({
        id: 'cs:' + id,
        track: 'CS',
        title: titles.get(id) ?? 'CS 답안 복습',
        href: '/q/' + encodeURIComponent(id),
        at: a.reviewedAt,
        due: a.nextReviewOn,
      })
  for (const [id, raw] of Object.entries(reviews)) {
    const v = raw as { due?: unknown }
    if (nodes.has(id) && stamp(v?.due) && Date.parse(v.due) <= now.getTime())
      due.push({
        id: 'pmp:' + id,
        track: 'PMP',
        title: nodes.get(id)!,
        href: pmpLessonHref(id),
        at: null,
        due: kstToday(new Date(v.due)),
      })
  }
  for (const [id, e] of Object.entries(library.entries)) {
    const item = {
      id,
      track: e.track === 'jira' ? 'Jira 과제' : '기술사',
      title: e.title,
      href: e.href,
      at: e.visitedAt > e.updatedAt ? e.visitedAt : e.updatedAt,
      ...(e.draft.trim() ? { excerpt: e.draft.trim().slice(0, 180) } : {}),
      ...(e.due ? { due: e.due } : {}),
    }
    recent.push(item)
    if (e.due && e.due <= today) due.push(item)
  }
  for (const x of pSeen.slice(0, 10))
    recent.push({
      id: 'pmp:' + x.id,
      track: 'PMP',
      title: nodes.get(x.id)!,
      href: pmpLessonHref(x.id),
      at: x.at,
    })
  for (const [id, a] of Object.entries(answers.drafts).slice(0, 100))
    if (nodeId(id) && stamp(a.updatedAt))
      recent.push({
        id: 'cs:' + id,
        track: 'CS',
        title: titles.get(id) ?? '작성한 CS 답안',
        href: '/q/' + encodeURIComponent(id),
        at: a.updatedAt,
      })
  if (current && !recent.some((x) => x.id === 'cs:' + current.nodeId))
    recent.push({
      id: 'cs:' + current.nodeId,
      track: 'CS',
      title: current.question.slice(0, 200),
      href: '/q/' + encodeURIComponent(current.nodeId),
      at: null,
    })
  if (stamp(j._updatedAt))
    recent.push({
      id: 'jira:last',
      track: 'Jira',
      title: jira.lessons.find((x) => x.id === last)?.title ?? 'Jira 공부방',
      href: '/jira/index.html#lesson/' + last,
      at: j._updatedAt,
    })
  const libraryItems = Object.values(library.entries),
    csRead = new Set([
      ...(journey?.occurrences ?? [])
        .filter((o) => nodeId(o.nodeId))
        .map((o) => o.nodeId),
      ...Object.values(streak.days).flat().filter(nodeId),
    ]).size
  const jiraLatest = recent
    .filter((x) => x.track === 'Jira' || x.track === 'Jira 과제')
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))[0]
  const cards: ProgressCard[] = [
    {
      id: 'cs',
      title: '컴퓨터과학',
      metrics: [
        ['읽은 질문', csRead],
        ['답안 초안', Object.keys(answers.drafts).length],
      ],
      href: current ? '/q/' + encodeURIComponent(current.nodeId) : '/me',
      resume: current?.question.slice(0, 160) ?? 'CS 기록·복습 보기',
    },
    {
      id: 'pmp',
      title: '프로젝트·제품 관리',
      metrics: [
        ['열어 본 수업', pSeen.length],
        ['복습 대기', due.filter((x) => x.track === 'PMP').length],
      ],
      href: pSeen[0] ? pmpLessonHref(pSeen[0].id) : '/learn/pmp',
      resume: pSeen[0] ? nodes.get(pSeen[0].id)! : 'PMP 통합 자습서',
    },
    {
      id: 'jira',
      title: 'Jira 실무',
      metrics: [
        ['완료 표시한 수업', done.length],
        ['맞힌 JQL', solved.length],
        [
          '실무 미션 기록',
          libraryItems.filter((x) => x.track === 'jira').length,
        ],
      ],
      href: jiraLatest?.href ?? '/jira/index.html#lesson/' + last,
      resume:
        jiraLatest?.title ??
        jira.lessons.find((x) => x.id === last)?.title ??
        'Jira 공부방',
    },
    {
      id: 'engineer',
      title: '정보관리기술사',
      metrics: [
        [
          '저장된 학습 항목',
          libraryItems.filter((x) => x.track === 'engineer').length,
        ],
        [
          '작성한 초안',
          libraryItems.filter((x) => x.track === 'engineer' && x.draft.trim())
            .length,
        ],
      ],
      href:
        recent
          .filter((x) => x.track === '기술사')
          .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))[0]?.href ??
        '/learn/engineer',
      resume:
        recent
          .filter((x) => x.track === '기술사')
          .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))[0]?.title ??
        '주제·기출 둘러보기',
    },
  ]
  cards.push({
    id: 'certificate',
    title: '정보처리기사 이론',
    metrics: [
      ['열어 본 이론', certificateRecent.length],
      [
        '작성한 메모',
        Object.values(certificateEntries).filter((e) => e.draft.trim()).length,
      ],
    ],
    href: certificateRecent[0]?.href ?? '/learn/certificate',
    resume: certificateRecent[0]?.title ?? 'DB·SQL 이론 읽기',
  })
  return {
    cards,
    due: due.sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '')),
    recent: recent.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')),
    unavailable,
    missionCount: libraryItems.filter((x) => x.track === 'jira').length,
  }
}
