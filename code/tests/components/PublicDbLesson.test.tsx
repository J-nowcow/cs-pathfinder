// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DbConnectionsPage, { metadata, dynamic } from '@/app/learn/db-connections/page'
import { metadata as pocMetadata } from '@/app/study-poc/page'
import { WORKSPACE_KEY } from '@/lib/study-poc/contract'
import { createSession, emptyWorkspace } from '@/lib/study-poc/model'

const stamp = '2026-11-15T00:00:00.000Z'
const lockDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks')
beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name: string, callback: () => unknown) => callback() } })
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks()
  if (lockDescriptor) Object.defineProperty(navigator, 'locks', lockDescriptor)
  else Reflect.deleteProperty(navigator, 'locks')
})

function existingSession() {
  const session = createSession('PRIVATE_LOCAL_GOAL', 'existing-session', stamp)
  session.currentActivity = 'reflect'
  session.activityOrder = ['experiment', 'check', 'compare', 'explain', 'reflect']
  session.answers.reflect = { text: 'PRIVATE_LOCAL_REFLECTION', updatedAt: stamp }
  session.answers.check = { text: 'PRIVATE_CHECK_BODY', updatedAt: stamp }
  const state = { ...emptyWorkspace(), currentSessionId: session.id, sessionsById: { [session.id]: session } }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state))
  return JSON.stringify(state)
}

describe('public DB learning integration', () => {
  it('is static and canonical, retains PoC noindex, and keeps local records out of shared HTML', () => {
    existingSession()
    const get = vi.spyOn(localStorage, 'getItem')
    const html = renderToStaticMarkup(<DbConnectionsPage />)
    expect(dynamic).toBe('force-static')
    expect(new URL(metadata.alternates!.canonical as string).pathname).toBe('/learn/db-connections')
    expect(metadata.robots).toBeUndefined()
    expect(pocMetadata.robots).toEqual({ index: false, follow: false })
    expect(get).not.toHaveBeenCalled()
    expect(html).not.toContain('PRIVATE_LOCAL')
    expect(html).toContain('<noscript>')
    expect(html).toContain('DB는 앱의 데이터를 저장하는 곳입니다')
    expect(html).toContain('https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS')
    expect(html).toContain('application/ld+json')
  })

  it('starts at the introduction with an existing session, then explicitly returns to the same saved location without writes or API requests', async () => {
    const original = existingSession()
    const set = vi.spyOn(localStorage, 'setItem')
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Public lesson must not request an API'))
    render(<DbConnectionsPage />)
    await screen.findByRole('heading', { name: 'DB 연결부터 살펴보기' })
    expect(screen.getByRole('heading', { name: 'DB 연결' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '공부 자료' }).getAttribute('href')).toBe('/#desk-shelf-title')
    expect(screen.getByRole('link', { name: '내 서재' }).getAttribute('href')).toBe('/learn/library')
    fireEvent.click(screen.getByRole('button', { name: '다음 장면' }))
    await userEvent.click(screen.getByRole('button', { name: '하던 학습으로 돌아가기' }))
    expect(screen.getByRole('heading', { name: '내 설명과 다음 질문' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: '내 설명과 다음에 확인할 질문' })).toHaveProperty('value', 'PRIVATE_LOCAL_REFLECTION')
    expect(screen.queryByText('학습 순서 추천')).toBeNull()
    expect(screen.queryByRole('button', { name: '학습 순서 추천받기' })).toBeNull()
    expect(set).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(original)
  })

  it('keeps the complete lesson local and creates a compatible session only at the explicit supplement action', async () => {
    localStorage.setItem('csqt.answer-practice.v2', 'OTHER_EXISTING_RECORD')
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Public lesson must not request an API'))
    render(<DbConnectionsPage />)
    await screen.findByRole('heading', { name: 'DB 연결부터 살펴보기' })
    expect(screen.queryByRole('button', { name: '하던 학습으로 돌아가기' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '도입 건너뛰고 트랜잭션 보기 →' }))
    for (let index = 0; index < 12; index++) fireEvent.click(screen.getByRole('button', { name: '다음 장면' }))
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '요청 수와 풀 크기 보충 실험 →' }))
    await waitFor(() => expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull())
    expect(screen.getByRole('heading', { name: '연결 수를 바꿔 대기를 확인하세요' })).toBeTruthy()
    const saved = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)
    expect(saved.version).toBe(1)
    expect(saved.sessionsById[saved.currentSessionId].packVersion).toBe('pool-poc-1')
    expect(saved.sessionsById[saved.currentSessionId].activityOrder).toEqual(['explain', 'experiment', 'compare', 'check', 'reflect'])
    expect(localStorage.getItem('csqt.answer-practice.v2')).toBe('OTHER_EXISTING_RECORD')
    expect(screen.queryByText('학습 순서 추천')).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
