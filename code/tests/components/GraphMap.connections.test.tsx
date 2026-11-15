// @vitest-environment happy-dom
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sheet } from '@/components/GraphMap'
import { getGraphNeighbors } from '@/lib/graph/relations'
import type { MapData } from '@/lib/db/graph'
import { STREAK_STORAGE_KEY } from '@/lib/streak/storage'
import { todayKst } from '@/lib/streak/client'
import { STREAK_SYNCED_EVENT } from '@/lib/journey/sync'

const DATA: MapData = {
  nodes: [
    { id: 'tcp', question: 'TCP는 무엇을 보장하나요?', category: '네트워크' },
    { id: 'handshake', question: '연결 전에 왜 handshake를 하나요?', category: '네트워크' },
    { id: 'cache', question: '캐시를 왜 사용하나요?', category: '데이터베이스' },
    { id: 'ttl', question: 'Redis TTL은 언제 쓰나요?', category: '데이터베이스' },
  ],
  edges: [
    { parentId: 'tcp', childId: 'handshake', kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', reason: '연결 보장을 바탕으로 초기 상태를 협의한다' },
    { parentId: 'cache', childId: 'ttl', kind: 'related', relationKind: 'instance_of', relationDirection: 'forward', reason: '캐시 만료의 구체적인 예시' },
  ],
}

function sheet(id: string, onOpen = vi.fn(), onClose = vi.fn()) {
  return <Sheet node={DATA.nodes.find((node) => node.id === id)!} links={getGraphNeighbors(DATA, id)} cameFrom={null} onOpen={onOpen} onClose={onClose} />
}

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"body":""}', { status: 200 })))
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('관계의 의미와 방향을 읽는 시트', () => {
  it.each(['prerequisite', 'instance_of'] as const)('시트에 직접 전달한 %s도 검토 표시가 없으면 방향을 단정하지 않는다', (relationKind) => {
    render(<Sheet node={DATA.nodes[0]} links={[
      { id: 'handshake', question: DATA.nodes[1].question, kind: 'related', relationKind, direction: 'incoming', reason: '방향 표시만으로 검토를 대신하지 않는다' },
    ]} cameFrom={null} onOpen={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('region', { name: '방향 미검증 관계' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: '먼저 살펴볼 개념' })).toBeNull()
    expect(screen.queryByRole('region', { name: '이 예시의 바탕 개념' })).toBeNull()
  })

  it.each(['prerequisite', 'instance_of'] as const)('미검증 %s 방향은 어느 쪽에서 열어도 학습 순서로 단정하지 않는다', (relationKind) => {
    const data: MapData = {
      nodes: DATA.nodes,
      edges: [{ parentId: 'tcp', childId: 'handshake', kind: 'related', relationKind, relationDirection: 'unreviewed', reason: '저장된 관계 설명을 먼저 확인해야 한다' }],
    }
    for (const node of data.nodes.slice(0, 2)) {
      const { unmount } = render(<Sheet node={node} links={getGraphNeighbors(data, node.id)} cameFrom={null} onOpen={vi.fn()} onClose={vi.fn()} />)
      expect(screen.getByRole('region', { name: '방향 미검증 관계' })).toBeTruthy()
      expect(screen.getByText('저장된 관계 설명을 먼저 확인해야 한다')).toBeTruthy()
      for (const title of ['먼저 살펴볼 개념', '다음으로 이어 볼 질문', '예시로 살펴볼 질문', '이 예시의 바탕 개념']) {
        expect(screen.queryByRole('region', { name: title })).toBeNull()
      }
      unmount()
    }
  })

  it('역방향으로 검토한 선행 관계는 원본 연결을 바꾸지 않고 안내한다', () => {
    const data: MapData = {
      nodes: DATA.nodes,
      edges: [{ parentId: 'tcp', childId: 'handshake', kind: 'related', relationKind: 'prerequisite', relationDirection: 'reverse', reason: '이 합성 검토에서는 handshake가 먼저다' }],
    }
    const before = structuredClone(data.edges)
    render(<Sheet node={DATA.nodes[0]} links={getGraphNeighbors(data, 'tcp')} cameFrom={null} onOpen={vi.fn()} onClose={vi.fn()} />)
    expect(within(screen.getByRole('region', { name: '먼저 살펴볼 개념' })).getByText(DATA.nodes[1].question)).toBeTruthy()
    expect(data.edges).toEqual(before)
  })

  it('선행 개념의 양쪽 끝에서 서로 다른 학습 방향을 설명한다', () => {
    const { unmount } = render(sheet('tcp'))
    const next = screen.getByRole('region', { name: '다음으로 이어 볼 질문' })
    expect(within(next).getByText('연결 전에 왜 handshake를 하나요?')).toBeTruthy()
    expect(within(next).getByText('연결 보장을 바탕으로 초기 상태를 협의한다')).toBeTruthy()
    expect(screen.queryByRole('region', { name: '먼저 살펴볼 개념' })).toBeNull()
    unmount()

    render(sheet('handshake'))
    const prior = screen.getByRole('region', { name: '먼저 살펴볼 개념' })
    expect(within(prior).getByText('TCP는 무엇을 보장하나요?')).toBeTruthy()
    expect(screen.queryByRole('region', { name: '다음으로 이어 볼 질문' })).toBeNull()
  })

  it('저장된 예시 방향을 일반 개념에서 구체 예시로 해석한다', () => {
    const { unmount } = render(sheet('cache'))
    expect(within(screen.getByRole('region', { name: '예시로 살펴볼 질문' })).getByText('Redis TTL은 언제 쓰나요?')).toBeTruthy()
    unmount()
    render(sheet('ttl'))
    expect(within(screen.getByRole('region', { name: '이 예시의 바탕 개념' })).getByText('캐시를 왜 사용하나요?')).toBeTruthy()
  })

  it('탐색 경로와 오래된 관계를 선행 개념으로 승격하지 않는다', () => {
    render(<Sheet node={DATA.nodes[0]} links={[
      { id: 'walked', question: '누군가 이어 읽은 질문', kind: 'walked', direction: 'incoming' },
      { id: 'legacy', question: '종류가 없는 과거 연결', reason: '과거에 저장한 이유' },
    ]} cameFrom="walked" onOpen={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('region', { name: '탐색으로 이어진 질문' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '관련된 질문' })).toBeTruthy()
    expect(screen.getByText('← 방금 여기서 왔습니다')).toBeTruthy()
    expect(screen.queryByRole('region', { name: '먼저 살펴볼 개념' })).toBeNull()
  })

  it('제목에 초점을 옮기고 키보드로 연결과 닫기를 조작한 뒤 원래 초점을 돌린다', async () => {
    const opener = document.createElement('button')
    opener.textContent = '시트 열기'
    document.body.append(opener)
    opener.focus()
    const onOpen = vi.fn()
    const onClose = vi.fn()
    const { unmount } = render(sheet('tcp', onOpen, onClose))
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'TCP는 무엇을 보장하나요?' }))
    const next = screen.getByText('연결 전에 왜 handshake를 하나요?').closest('button')!
    next.focus()
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledWith('handshake')
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})

describe('지도에서 연 해설과 기존 읽기 기록의 연결', () => {
  it('성공한 해설만 기존 날짜·질문을 보존해 기록하며 StrictMode에서도 중복되지 않는다', async () => {
    const day = todayKst()
    window.localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-11-01': ['older'], [day]: ['already-read'] }, extension: { note: 'preserve this existing field' } }))
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"body":"성공적으로 연 해설"}', { status: 200 })))
    const changed = vi.fn()
    window.addEventListener(STREAK_SYNCED_EVENT, changed)
    render(<StrictMode>{sheet('tcp')}</StrictMode>)
    await screen.findByText('성공적으로 연 해설')
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(STREAK_STORAGE_KEY)!)
      expect(saved.days[day]).toEqual(['already-read', 'tcp'])
      expect(saved.days['2026-11-01']).toEqual(['older'])
      expect(saved.extension).toEqual({ note: 'preserve this existing field' })
    })
    expect(changed).toHaveBeenCalledOnce()
    window.removeEventListener(STREAK_SYNCED_EVENT, changed)
  })

  it('실패한 읽기는 기록하지 않고 다시 불러오기가 성공한 뒤에만 기록한다', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"body":"복구한 해설"}', { status: 200 })))
    render(sheet('tcp'))
    const retry = await screen.findByRole('button', { name: '다시 불러오기' })
    expect(window.localStorage.getItem(STREAK_STORAGE_KEY)).toBeNull()
    await userEvent.click(retry)
    await screen.findByText('복구한 해설')
    expect(JSON.parse(window.localStorage.getItem(STREAK_STORAGE_KEY)!).days[todayKst()]).toEqual(['tcp'])
  })

  it('이전 노드의 JSON이 늦게 도착해도 현재 해설과 읽기 기록을 덮지 않는다', async () => {
    let resolveOldJson!: (body: { body: string }) => void
    const oldJson = new Promise<{ body: string }>((resolve) => { resolveOldJson = resolve })
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => oldJson })
      .mockResolvedValueOnce(new Response('{"body":"현재 질문의 해설"}', { status: 200 })))
    const { rerender } = render(sheet('tcp'))
    // Let the old response reach its still-pending JSON parsing phase.
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledOnce())
    await Promise.resolve()
    rerender(sheet('handshake'))
    await screen.findByText('현재 질문의 해설')
    resolveOldJson({ body: '늦은 과거 질문의 해설' })
    await Promise.resolve()
    await Promise.resolve()
    expect(screen.queryByText('늦은 과거 질문의 해설')).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(STREAK_STORAGE_KEY)!).days[todayKst()]).toEqual(['handshake'])
  })

  it.each([
    '{broken',
    JSON.stringify({ version: 2, days: { '2026-11-01': ['future-record'] } }),
    JSON.stringify({ version: 1, days: 'not-an-object' }),
    JSON.stringify({ version: 1, days: { '2026-11-01': 'not-an-array' } }),
    JSON.stringify({ version: 1, days: { '2026-11-01': ['saved', 9] } }),
  ])('손상되거나 지원하지 않는 기록은 원문 그대로 보존한다 (%s)', async (raw) => {
    window.localStorage.setItem(STREAK_STORAGE_KEY, raw)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"body":"읽을 수 있는 해설"}', { status: 200 })))
    render(sheet('tcp'))
    await screen.findByText('읽을 수 있는 해설')
    expect(window.localStorage.getItem(STREAK_STORAGE_KEY)).toBe(raw)
  })
})
