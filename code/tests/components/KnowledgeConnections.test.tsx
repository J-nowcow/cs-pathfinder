// @vitest-environment happy-dom
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToStaticMarkup } from 'react-dom/server'
import { KnowledgeConnections } from '@/components/knowledge/KnowledgeConnections'
import type { MapData } from '@/lib/db/graph'
import { STREAK_STORAGE_KEY, serializeStreak } from '@/lib/streak/storage'
import { STREAK_SYNCED_EVENT } from '@/lib/journey/sync'
import { ANSWER_PRACTICE_STORAGE_KEY, emptyAnswerPractice, serializeAnswerPractice, updateAnswerDraft } from '@/lib/answer-practice/storage'

vi.mock('@/lib/site', () => ({ siteUrl: () => new URL('https://public.example.test') }))

const data: MapData = {
  nodes: [
    { id: 'base', question: '트랜잭션을 쓰는 이유는?', category: '데이터베이스' },
    { id: 'read', question: '락이 대기를 만드는 조건은?', category: '데이터베이스' },
    { id: 'next', question: '연결풀과 대기는 어떻게 이어질까?', category: '운영체제' },
  ],
  edges: [
    { parentId: 'base', childId: 'read', kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', reason: '선행 관계의 이유' },
    { parentId: 'read', childId: 'next', kind: 'related', relationKind: 'shares_concept', reason: '공유 자원의 대기라는 연결' },
  ],
}

beforeEach(() => window.localStorage.clear())
const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  if (createObjectUrlDescriptor) Object.defineProperty(URL, 'createObjectURL', createObjectUrlDescriptor)
  else Reflect.deleteProperty(URL, 'createObjectURL')
  if (revokeObjectUrlDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor)
  else Reflect.deleteProperty(URL, 'revokeObjectURL')
})

function saveRead(ids: string[]) {
  window.localStorage.setItem(STREAK_STORAGE_KEY, serializeStreak({ days: { '2026-11-11': ids } }))
}

describe('recorded knowledge connections', () => {
  it('does not read browser records or expose them during server rendering', () => {
    saveRead(['read'])
    const getItem = vi.spyOn(window.localStorage, 'getItem')
    const html = renderToStaticMarkup(<KnowledgeConnections data={data} onOpen={() => {}} />)
    expect(getItem).not.toHaveBeenCalled()
    expect(html).toContain('이 브라우저의 기록을 읽고 있어요.')
    expect(html).not.toContain('선행 관계의 이유')
  })

  it('opens a typed unread neighbor from local records without requests or private answer text', async () => {
    saveRead(['read', 'private-question-id'])
    const practice = updateAnswerDraft(emptyAnswerPractice(), 'read', 'PRIVATE_SYNTHETIC_ANSWER_DO_NOT_DISPLAY', '2026-11-11T00:00:00Z')
    window.localStorage.setItem(ANSWER_PRACTICE_STORAGE_KEY, serializeAnswerPractice(practice))
    const onOpen = vi.fn()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const setItem = vi.spyOn(window.localStorage, 'setItem')
    const { container } = render(<KnowledgeConnections data={data} onOpen={onOpen} />)
    const next = await screen.findByRole('region', { name: '기록한 질문과 연결된 질문' })
    expect(within(next).getByText(/바탕이 되는 질문/)).toBeTruthy()
    expect(within(next).getByText('선행 관계의 이유')).toBeTruthy()
    expect(within(next).getByText('공유 자원의 대기라는 연결')).toBeTruthy()
    await userEvent.click(within(next).getByRole('button', { name: '연결풀과 대기는 어떻게 이어질까?' }))
    expect(onOpen).toHaveBeenCalledWith('next')
    expect(setItem).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(container.textContent).not.toMatch(/private-question-id|PRIVATE_SYNTHETIC_ANSWER_DO_NOT_DISPLAY/)
    expect(screen.getByText(/읽음·답변 기록은 이해도 평가가 아닙니다/)).toBeTruthy()
  })

  it('does not turn an unreviewed source direction into prerequisites, examples or personal arrows', async () => {
    saveRead(['base', 'read'])
    const unreviewed: MapData = { ...data, edges: [
      { parentId: 'read', childId: 'base', kind: 'related', relationKind: 'prerequisite', reason: '실제 원본은 반대 방향일 수 있음' },
      { parentId: 'read', childId: 'next', kind: 'related', relationKind: 'instance_of', reason: '예시 방향도 미확인' },
    ] }
    render(<KnowledgeConnections data={unreviewed} onOpen={() => {}} />)
    const next = await screen.findByRole('region', { name: '기록한 질문과 연결된 질문' })
    expect(within(next).getByText(/개념·예시 관계 · 방향 미확인/)).toBeTruthy()
    expect(within(next).queryByText(/개념을 보여주는 예시|예시의 바탕 개념/)).toBeNull()
    const connections = screen.getByRole('region', { name: '이미 본 질문 사이의 관계' })
    expect(within(connections).getByText('선후 관계 · 방향 미확인')).toBeTruthy()
    expect(within(connections).getByText('↔')).toBeTruthy()
    expect(within(connections).queryByText('→')).toBeNull()
    expect(within(connections).queryByText('바탕 질문 → 이어지는 질문')).toBeNull()
  })

  it('recomputes after a successful same-tab reading event, keeping existing storage unchanged', async () => {
    saveRead(['read'])
    render(<KnowledgeConnections data={data} onOpen={() => {}} />)
    const next = await screen.findByRole('region', { name: '기록한 질문과 연결된 질문' })
    expect(within(next).getByRole('button', { name: '연결풀과 대기는 어떻게 이어질까?' })).toBeTruthy()
    saveRead(['read', 'next'])
    const before = window.localStorage.getItem(STREAK_STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(STREAK_SYNCED_EVENT))
    await waitFor(() => expect(within(next).queryByRole('button', { name: '연결풀과 대기는 어떻게 이어질까?' })).toBeNull())
    const connections = screen.getByRole('region', { name: '이미 본 질문 사이의 관계' })
    expect(within(connections).getByText('공유하는 개념')).toBeTruthy()
    expect(within(connections).getByRole('button', { name: '연결풀과 대기는 어떻게 이어질까?' })).toBeTruthy()
    expect(window.localStorage.getItem(STREAK_STORAGE_KEY)).toBe(before)
  })

  it('shows an honest empty public-map state and an ordinary reading link', async () => {
    saveRead(['private-question-id'])
    render(<KnowledgeConnections data={data} onOpen={() => {}} />)
    expect(await screen.findByText('공개 지도와 연결되는 기록이 아직 없어요.')).toBeTruthy()
    expect(screen.getByRole('link', { name: '질문 목록에서 시작하기 →' }).getAttribute('href')).toBe('/questions')
    expect(screen.queryByText('열어 본 질문')).toBeNull()
  })

  it('reports blocked storage instead of falsely claiming no records', async () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    render(<KnowledgeConnections data={data} onOpen={() => {}} />)
    expect(await screen.findByText('브라우저 기록을 읽을 수 없습니다.')).toBeTruthy()
    expect(screen.queryByText('공개 지도와 연결되는 기록이 아직 없어요.')).toBeNull()
    expect(screen.getByRole('link', { name: '질문 목록 열기 →' })).toBeTruthy()
  })

  it('keeps malformed raw records and valid reading history while explaining partial results', async () => {
    saveRead(['read'])
    window.localStorage.setItem(ANSWER_PRACTICE_STORAGE_KEY, '{broken-private-answer-record')
    render(<KnowledgeConnections data={data} onOpen={() => {}} />)
    expect(await screen.findByText(/일부 기록을 읽지 못했습니다/)).toBeTruthy()
    const recorded = screen.getByRole('region', { name: '분야별로 다시 찾기' })
    expect(within(recorded).getByRole('button', { name: '락이 대기를 만드는 조건은?' })).toBeTruthy()
    expect(window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY)).toBe('{broken-private-answer-record')
  })

  it('filters recorded categories by keyboard and cleans up listeners under StrictMode', async () => {
    saveRead(['read', 'next'])
    const getItem = vi.spyOn(window.localStorage, 'getItem')
    const setItem = vi.spyOn(window.localStorage, 'setItem')
    const { unmount } = render(<StrictMode><KnowledgeConnections data={data} onOpen={() => {}} /></StrictMode>)
    const recorded = await screen.findByRole('region', { name: '분야별로 다시 찾기' })
    const category = within(recorded).getByRole('button', { name: '운영체제 1' })
    category.focus()
    await userEvent.keyboard('{Enter}')
    expect(category.getAttribute('aria-pressed')).toBe('true')
    expect(within(recorded).queryByRole('button', { name: '락이 대기를 만드는 조건은?' })).toBeNull()
    expect(within(recorded).getByRole('button', { name: '연결풀과 대기는 어떻게 이어질까?' })).toBeTruthy()
    expect(setItem).not.toHaveBeenCalled()
    unmount()
    const calls = getItem.mock.calls.length
    window.dispatchEvent(new CustomEvent(STREAK_SYNCED_EVENT))
    window.dispatchEvent(new StorageEvent('storage', { key: STREAK_STORAGE_KEY }))
    expect(getItem.mock.calls.length).toBe(calls)
  })

  it('searches recorded public titles/categories within the selected category, with clear and honest empty results', async () => {
    saveRead(['base', 'read', 'next'])
    const answers = updateAnswerDraft(emptyAnswerPractice(), 'next', 'SECRET_ANSWER_SEARCH_MARKER', '2026-11-11T00:00:00Z')
    window.localStorage.setItem(ANSWER_PRACTICE_STORAGE_KEY, serializeAnswerPractice(answers))
    const raw = window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<KnowledgeConnections data={data} onOpen={() => {}} />)
    const recorded = await screen.findByRole('region', { name: '분야별로 다시 찾기' })
    const search = within(recorded).getByRole('searchbox', { name: '기록한 질문 검색' })
    search.focus()
    await userEvent.keyboard('대기')
    expect(within(recorded).getByText('2개 질문 표시')).toBeTruthy()
    const category = within(recorded).getByRole('button', { name: '운영체제 1' })
    category.focus()
    await userEvent.keyboard('{Enter}')
    expect(within(recorded).getByText('1개 질문 표시')).toBeTruthy()
    expect(within(recorded).queryByRole('button', { name: '락이 대기를 만드는 조건은?' })).toBeNull()
    await userEvent.clear(search)
    await userEvent.type(search, 'SECRET_ANSWER_SEARCH_MARKER')
    expect(within(recorded).getByText('0개 질문 표시')).toBeTruthy()
    expect(within(recorded).getByText(/조건에 맞는 기록한 질문이 없습니다/)).toBeTruthy()
    const clear = within(recorded).getByRole('button', { name: '검색 지우기' })
    clear.focus()
    await userEvent.keyboard('{Enter}')
    expect(document.activeElement).toBe(search)
    expect((search as HTMLInputElement).value).toBe('')
    expect(category.getAttribute('aria-pressed')).toBe('true')
    expect(within(recorded).getByText('1개 질문 표시')).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY)).toBe(raw)
  })

  it('reveals every additional neighbor and recorded relation while retaining final-button keyboard focus', async () => {
    const recordedNodes = Array.from({ length: 11 }, (_, index) => ({ id: `r${index}`, question: `기록 질문 ${index}`, category: '분야' }))
    const unreadNodes = Array.from({ length: 9 }, (_, index) => ({ id: `u${index}`, question: `주변 질문 ${index}`, category: '분야' }))
    const many: MapData = { nodes: [...recordedNodes, ...unreadNodes], edges: [
      ...recordedNodes.slice(1).map((node, index) => ({ parentId: `r${index}`, childId: node.id, kind: 'related' as const, relationKind: 'prerequisite' as const })),
      ...unreadNodes.map((node) => ({ parentId: 'r0', childId: node.id, kind: 'related' as const, relationKind: 'shares_concept' as const, reason: '공유 맥락' })),
    ] }
    saveRead(recordedNodes.map((node) => node.id))
    const onOpen = vi.fn()
    render(<KnowledgeConnections data={many} onOpen={onOpen} />)
    const next = await screen.findByRole('region', { name: '기록한 질문과 연결된 질문' })
    expect(within(next).getAllByRole('listitem')).toHaveLength(6)
    const more = within(next).getByRole('button', { name: '연결된 질문 더 보기 (3개 남음)' })
    more.focus()
    await userEvent.keyboard('{Enter}')
    expect(within(next).getAllByRole('listitem')).toHaveLength(9)
    expect(document.activeElement).toBe(more)
    expect(more.getAttribute('aria-disabled')).toBe('true')
    expect(more.textContent).toBe('연결된 질문 모두 표시함')
    await userEvent.keyboard('{Enter}')
    expect(within(next).getAllByRole('listitem')).toHaveLength(9)
    await userEvent.click(within(next).getByRole('button', { name: '주변 질문 8' }))
    expect(onOpen).toHaveBeenCalledWith('u8')
    const pairs = screen.getByRole('region', { name: '이미 본 질문 사이의 관계' })
    expect(within(pairs).getAllByRole('listitem')).toHaveLength(8)
    const morePairs = within(pairs).getByRole('button', { name: '기록 사이 연결 더 보기 (2개 남음)' })
    morePairs.focus()
    await userEvent.keyboard('{Enter}')
    expect(within(pairs).getAllByRole('listitem')).toHaveLength(10)
    expect(document.activeElement).toBe(morePairs)
    expect(morePairs.getAttribute('aria-disabled')).toBe('true')
    expect(within(pairs).getAllByText('선후 관계 · 방향 미확인')).toHaveLength(10)
    expect(within(pairs).queryByText('→')).toBeNull()
  })

  it('downloads a local Markdown document on request and releases the URL without changing records', async () => {
    saveRead(['base', 'read'])
    const raw = window.localStorage.getItem(STREAK_STORAGE_KEY)
    const create = vi.fn((_blob: Blob) => 'blob:knowledge-test')
    const revoke = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<KnowledgeConnections data={data} onOpen={() => {}} />)
    const download = await screen.findByRole('button', { name: '연결 정리 내려받기' })
    await userEvent.type(screen.getByRole('searchbox', { name: '기록한 질문 검색' }), '일치하지 않는 검색어')
    expect(screen.getByText('0개 질문 표시')).toBeTruthy()
    vi.useFakeTimers()
    fireEvent.click(download)
    expect(create).toHaveBeenCalledTimes(1)
    const blob = create.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/markdown;charset=utf-8')
    const markdown = await blob.text()
    expect(markdown).toContain('## 기록 사이의 연결')
    expect(markdown).toContain('https://public.example.test/q/base')
    expect(markdown).toContain('https://public.example.test/q/read')
    expect(markdown).not.toContain(window.location.origin)
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[download]')).toBeNull()
    expect(screen.getByText(/다운로드를 시작했습니다/)).toBeTruthy()
    expect(window.localStorage.getItem(STREAK_STORAGE_KEY)).toBe(raw)
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:knowledge-test')
  })

  it('keeps records intact when the browser cannot create a download', async () => {
    saveRead(['read'])
    const raw = window.localStorage.getItem(STREAK_STORAGE_KEY)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => { throw new Error('download unavailable') } })
    render(<KnowledgeConnections data={data} onOpen={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '연결 정리 내려받기' }))
    expect(screen.getByText(/다운로드를 시작하지 못했습니다. 기록은 그대로입니다/)).toBeTruthy()
    expect(window.localStorage.getItem(STREAK_STORAGE_KEY)).toBe(raw)
  })
})
