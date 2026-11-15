// @vitest-environment happy-dom
import { StrictMode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StudyPoc } from '@/components/study-poc/StudyPoc'
import StudyPocPage, { metadata } from '@/app/study-poc/page'
import { WORKSPACE_KEY, type Workspace } from '@/lib/study-poc/contract'
import { createSession, emptyWorkspace } from '@/lib/study-poc/model'
import { exportWorkspace } from '@/lib/study-poc/storage'

const stamp = '2026-11-12T00:00:00.000Z'
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
const step = (name: string) => within(screen.getByRole('navigation', { name: '현재 학습과 단계' })).getByRole('button', { name: new RegExp(name) })
function zoneCount(name: string) {
  return Number(screen.getByRole('region', { name }).querySelector('.sp-zone-count')!.textContent!.replace('개', ''))
}
function counts() { return ['연결 빌리기 전 대기', '연결을 빌린 뒤 DB 대기', 'DB에서 처리 중', '지금까지 완료'].map(zoneCount) }
async function supplementButton() {
  await userEvent.click(await screen.findByRole('button', { name: '도입 건너뛰고 트랜잭션 보기 →' }))
  for (let index = 0; index < 12; index++) fireEvent.click(screen.getByRole('button', { name: '다음 장면' }))
  return screen.getByRole('button', { name: '요청 수와 풀 크기 보충 실험 →' })
}
async function begin() {
  render(<StudyPoc />)
  await userEvent.click(await supplementButton())
  await userEvent.click(step('풀의 역할 읽기'))
  await screen.findByRole('heading', { name: '커넥션 풀은 연결을 어떻게 관리할까?' })
  await openNotes()
}
async function openNotes() {
  const toggle = screen.queryByText('메모 남기기')
  if (toggle && !toggle.closest('details')?.open) await userEvent.click(toggle)
}
async function saved() {
  await waitFor(() => expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull())
  await waitFor(() => expect(screen.getByRole('textbox', { name: /메모|내 선택|내 설명과 다음/ })).not.toHaveProperty('disabled', true))
}
function seedSession(text = ''): Workspace {
  const session = createSession('커넥션 풀의 두 역할을 연결하기', 'saved-session', stamp)
  if (text) session.answers.explain = { text, updatedAt: stamp }
  const workspace = { ...emptyWorkspace(), currentSessionId: session.id, sessionsById: { [session.id]: session } }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace))
  return workspace
}

function seedExperiment() {
  const state = seedSession()
  const current = state.sessionsById[state.currentSessionId!]
  current.currentActivity = 'experiment'
  current.experiment = { pool: 2, requests: 12, dbCapacity: 3 }
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state))
}

describe('study PoC editorial workspace', () => {
  it('keeps SSR free of private records and goal forms, with no-JS reading and noindex metadata', () => {
    seedSession('PRIVATE_SSR_ANSWER')
    const get = vi.spyOn(localStorage, 'getItem')
    const html = renderToStaticMarkup(<StudyPocPage />)
    expect(get).not.toHaveBeenCalled()
    expect(html).not.toContain('PRIVATE_SSR_ANSWER')
    expect(html).not.toContain('<form')
    expect(html).toContain('연결 재사용은 네트워크 연결·인증·세션 준비')
    expect(html).toContain('https://www.postgresql.org/docs/current/runtime-config-connection.html')
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('introduces connection before the experiment and creates only the explicit new session', async () => {
    render(<StudyPoc />)
    expect(await screen.findByRole('heading', { name: 'DB 연결부터 살펴보기' })).toBeTruthy()
    expect(screen.getByText('연결을 열면 앱과 DB가 명령과 결과를 주고받을 수 있습니다.')).toBeTruthy()
    expect(screen.queryByRole('slider')).toBeNull()
    const optionalGoal = screen.getByText('질문 바꾸기').closest('details')!
    expect(optionalGoal.open).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '다음 장면' }))
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull()
    await userEvent.click(screen.getByText('질문 바꾸기'))
    await userEvent.clear(screen.getByRole('textbox', { name: '이번에 확인할 질문' }))
    await userEvent.click(await supplementButton())
    expect(await screen.findByRole('heading', { name: '연결 수를 바꿔 대기를 확인하세요' })).toBeTruthy()
    await waitFor(() => {
      const state = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)
      expect(state.sessionsById[state.currentSessionId].experiment).toEqual({ pool: 2, requests: 12, dbCapacity: 3 })
      expect(state.sessionsById[state.currentSessionId].activityOrder).toEqual(['explain', 'experiment', 'compare', 'check', 'reflect'])
      expect(state.sessionsById[state.currentSessionId].goal).toBe('커넥션 풀을 늘리면 왜 항상 빨라지지는 않을까?')
    })
  })

  it('reviews the introduction without changing an existing session and returns to its saved position', async () => {
    const state = seedSession('existing explanation')
    const current = state.sessionsById[state.currentSessionId!]
    current.currentActivity = 'experiment'
    current.activityOrder = ['experiment', 'check', 'compare', 'explain', 'reflect']
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state))
    const original = localStorage.getItem(WORKSPACE_KEY)
    render(<StudyPoc />)
    await userEvent.click(await screen.findByRole('button', { name: 'DB 연결 처음 보기' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 장면' }))
    await userEvent.click(screen.getByRole('button', { name: '도입 건너뛰고 트랜잭션 보기 →' }))
    for (let index = 0; index < 5; index++) fireEvent.click(screen.getByRole('button', { name: '다음 장면' }))
    expect(screen.queryByRole('button', { name: /풀 크기 실험.*→/ })).toBeNull()
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(original)
    await userEvent.click(screen.getByRole('button', { name: '하던 학습으로 돌아가기' }))
    expect(screen.getByRole('heading', { name: '연결 수를 바꿔 대기를 확인하세요' })).toBeTruthy()
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(original)
  })

  it('shows compact conditions before controls and keeps technical assumptions in the disclosure', async () => {
    render(<StudyPoc />)
    await userEvent.click(await supplementButton())
    const intro = await screen.findByRole('region', { name: '실험 조건' })
    const calculation = screen.getByRole('region', { name: '완료 시간 계산 과정' })
    expect(intro.closest('details')).toBeNull()
    expect(intro.textContent).toContain('행 잠금 대기를 제외하고 DB 동시 처리 한도를 정한 보충 실험입니다.')
    const poolControl = screen.getByRole('slider', { name: /동시에 빌려줄 연결 수/ })
    const timeControl = screen.getByRole('slider', { name: /예시 시간/ })
    const states = screen.getByRole('region', { name: '연결 빌리기 전 대기' })
    expect(intro.compareDocumentPosition(poolControl) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(poolControl.compareDocumentPosition(timeControl) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(timeControl.compareDocumentPosition(states) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(states.compareDocumentPosition(calculation) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(intro.compareDocumentPosition(calculation) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(intro.textContent).toContain('DB 조회 요청 12개가 동시에 도착')
    expect(intro.textContent).toContain('최대 3개씩')
    expect(intro.textContent).toContain('요청당 3초가 걸린다고 가정')
    await userEvent.click(screen.getByText('실험의 가정과 전체 수치'))
    expect(screen.getByText(/준비된 연결 하나로 요청 하나를 처리/)).toBeTruthy()
    expect(screen.getByText(/계산에는 대기 시간도 포함합니다/)).toBeTruthy()
    expect(screen.getByText(/실제 DB에서 측정한 결과는 아닙니다/)).toBeTruthy()
    expect(calculation.getAttribute('aria-live')).toBe('polite')
    expect(screen.queryByText(/교육용 단계|시간칸/)).toBeNull()
  })

  it('explains resumed custom inputs and partial batches without rewriting old answer units', async () => {
    const state = seedSession()
    const selected = state.sessionsById[state.currentSessionId!]
    selected.currentActivity = 'experiment'
    selected.experiment = { pool: 12, requests: 1, dbCapacity: 12 }
    selected.answers.experiment = { text: '이전에 적은 18교육용단계 메모', updatedAt: stamp }
    const original = JSON.stringify(state)
    localStorage.setItem(WORKSPACE_KEY, original)
    const set = vi.spyOn(localStorage, 'setItem')
    render(<StudyPoc />)
    const intro = await screen.findByRole('region', { name: '실험 조건' })
    const calculation = screen.getByRole('region', { name: '완료 시간 계산 과정' })
    expect(intro.compareDocumentPosition(calculation) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    expect(intro.textContent).toContain('요청 1개가 동시에 도착')
    expect(intro.textContent).toContain('최대 12개씩')
    expect(calculation.textContent).toContain('요청 1개를 한 번에 처리')
    expect(calculation.textContent).toContain('1묶음 × 3초 = 3초')
    expect(set).not.toHaveBeenCalled()
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(original)
    await userEvent.click(screen.getByText('요청 수·DB 조건 직접 바꾸기'))
    fireEvent.change(screen.getByRole('slider', { name: /동시에 빌려줄 연결 수/ }), { target: { value: '2' } })
    fireEvent.change(screen.getByRole('slider', { name: /동시에 온 요청/ }), { target: { value: '11' } })
    fireEvent.change(screen.getByRole('slider', { name: /DB가 동시에 처리할 요청 수/ }), { target: { value: '3' } })
    expect(calculation.textContent).toContain('11개를 2개씩, 총 6묶음')
    expect(calculation.textContent).toContain('마지막 묶음은 1개만 처리')
    expect(calculation.textContent).toContain('6묶음 × 3초 = 18초')
    await waitFor(() => {
      const latest = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)
      expect(latest.sessionsById[latest.currentSessionId].answers.experiment.text).toBe('이전에 적은 18교육용단계 메모')
    })
  })

  it('starts, changes activity without losing edits and resumes current activity after remount', async () => {
    await begin()
    const editor = screen.getByRole('textbox', { name: '메모' })
    await userEvent.type(editor, '재사용과 동시성 제한은 서로 다른 역할이다.')
    await userEvent.click(step('차이 비교하기'))
    await openNotes()
    await userEvent.type(screen.getByRole('textbox', { name: '메모' }), '질의 실행 비용은 남는다.')
    await waitFor(() => {
      const state = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)
      const current = state.sessionsById[state.currentSessionId]
      expect(current.currentActivity).toBe('compare')
      expect(current.answers.compare.text).toBe('질의 실행 비용은 남는다.')
      expect(current.answers.explain.text).toBe('재사용과 동시성 제한은 서로 다른 역할이다.')
    })
    cleanup(); render(<StudyPoc />)
    expect(await screen.findByRole('heading', { name: '연결을 매번 만들 때와 재사용할 때의 차이' })).toBeTruthy()
    await openNotes()
    expect((screen.getByRole('textbox', { name: '메모' }) as HTMLTextAreaElement).value).toBe('질의 실행 비용은 남는다.')
    await userEvent.click(step('풀의 역할 읽기'))
    await openNotes()
    expect((screen.getByRole('textbox', { name: '메모' }) as HTMLTextAreaElement).value).toBe('재사용과 동시성 제한은 서로 다른 역할이다.')
  })

  it('compares pool capacity through native controls with the same simulation and honest assumptions', async () => {
    await begin(); await userEvent.click(step('풀 크기 바꾸기'))
    const pool = screen.getByRole('slider', { name: /동시에 빌려줄 연결 수/ })
    const calc = screen.getByRole('region', { name: '완료 시간 계산 과정' })
    fireEvent.change(pool, { target: { value: '2' } })
    expect(calc.textContent).toContain('6묶음 × 3초 = 18초')
    fireEvent.change(pool, { target: { value: '3' } })
    expect(calc.textContent).toContain('4묶음 × 3초 = 12초')
    expect(zoneCount('연결을 빌린 뒤 DB 대기')).toBe(0)
    fireEvent.change(pool, { target: { value: '6' } })
    expect(calc.textContent).toContain('4묶음 × 3초 = 12초')
    expect(zoneCount('연결을 빌린 뒤 DB 대기')).toBe(3)
    fireEvent.change(pool, { target: { value: '12' } })
    expect(calc.textContent).toContain('4묶음 × 3초 = 12초')
    await userEvent.click(screen.getByText('요청 수·DB 조건 직접 바꾸기'))
    fireEvent.change(screen.getByRole('slider', { name: /DB가 동시에 처리할 요청 수/ }), { target: { value: '1' } })
    expect(calc.textContent).toContain('12묶음 × 3초 = 36초')
    await userEvent.click(screen.getByText('실험의 가정과 전체 수치'))
    expect(screen.getByText(/연결 생성·네트워크·SQL 비용·추가 경합 지연은 제외합니다/)).toBeTruthy()
    expect(screen.getByRole('table', { name: '시간별 요청 상태' })).toBeTruthy()
    expect(screen.queryByText(/최적 풀 크기:|실측 결과/)).toBeNull()
    expect(calc.textContent).not.toContain('0초부터 모든 요청이 끝날 때까지')
  })

  it('scrubs actual aggregate rows without persisting time and saves changed pool conditions', async () => {
    seedExperiment()
    render(<StudyPoc />)
    const time = await screen.findByRole('slider', { name: /예시 시간/ })
    const pool = screen.getByRole('slider', { name: /동시에 빌려줄 연결 수/ })
    const set = vi.spyOn(localStorage, 'setItem')
    expect(counts()).toEqual([10, 0, 2, 0])
    fireEvent.change(time, { target: { value: '6' } })
    expect(counts()).toEqual([6, 0, 2, 4])
    expect(counts().reduce((a, b) => a + b, 0)).toBe(12)
    fireEvent.change(time, { target: { value: '18' } })
    expect(counts()).toEqual([0, 0, 0, 12])
    expect(set).not.toHaveBeenCalled()
    pool.focus()
    fireEvent.change(pool, { target: { value: '6' } })
    expect(document.activeElement).toBe(pool)
    expect(time).toHaveProperty('value', '0')
    expect(time).toHaveProperty('max', '12')
    expect(counts()).toEqual([6, 3, 3, 0])
    fireEvent.change(time, { target: { value: '3' } })
    expect(counts()).toEqual([3, 3, 3, 3])
    await waitFor(() => {
      const state = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)
      expect(state.sessionsById[state.currentSessionId].experiment.pool).toBe(6)
      expect(JSON.stringify(state)).not.toContain('elapsed')
    })
    expect(screen.queryByText('동그라미 하나가 요청 하나를 나타냅니다.')).toBeNull()
    expect(screen.queryByRole('button', { name: /재생/ })).toBeNull()
    expect(screen.getByRole('region', { name: 'DB에서 처리 중' }).querySelector('.sp-request-dots')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('resets every changed condition including a return to prior parameters while preserving slider focus', async () => {
    seedExperiment()
    render(<StudyPoc />)
    const time = await screen.findByRole('slider', { name: /예시 시간/ })
    const pool = screen.getByRole('slider', { name: /동시에 빌려줄 연결 수/ })
    fireEvent.change(time, { target: { value: '6' } })
    expect(time).toHaveProperty('value', '6')
    pool.focus()
    fireEvent.change(pool, { target: { value: '6' } })
    expect(time).toHaveProperty('value', '0')
    fireEvent.change(pool, { target: { value: '2' } })
    expect(time).toHaveProperty('value', '0')
    expect(document.activeElement).toBe(pool)
    expect(counts()).toEqual([10, 0, 2, 0])
  })

  it('keeps the observation clock local across memo edits and resets it between same-parameter sessions', async () => {
    const state = seedSession()
    const first = state.sessionsById[state.currentSessionId!]
    first.currentActivity = 'experiment'
    first.experiment = { pool: 2, requests: 12, dbCapacity: 3 }
    const second = createSession('같은 조건의 다른 질문', 'second-session', stamp)
    second.currentActivity = 'experiment'; second.experiment = { ...first.experiment }
    state.sessionsById[second.id] = second
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state))
    render(<StudyPoc />)
    const time = await screen.findByRole('slider', { name: /예시 시간/ })
    const set = vi.spyOn(localStorage, 'setItem')
    fireEvent.change(time, { target: { value: '6' } })
    expect(set).not.toHaveBeenCalled()
    await openNotes()
    await userEvent.type(screen.getByRole('textbox', { name: '메모' }), '현재 관찰 시각과 별개로 기록')
    expect(time).toHaveProperty('value', '6')
    await waitFor(() => {
      const latest = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)
      expect(latest.sessionsById[first.id].answers.experiment.text).toBe('현재 관찰 시각과 별개로 기록')
      expect(latest.sessionsById[first.id].experiment).toEqual({ pool: 2, requests: 12, dbCapacity: 3 })
      expect(JSON.stringify(latest)).not.toContain('elapsed')
    })
    await userEvent.click(screen.getByText('기록·새 질문'))
    await userEvent.click(screen.getByRole('button', { name: second.goal }))
    expect(screen.getByRole('slider', { name: /예시 시간/ })).toHaveProperty('value', '0')
    expect(counts()).toEqual([10, 0, 2, 0])
    expect(screen.getByRole('navigation', { name: '현재 학습과 단계' })).toBeTruthy()
  })

  it('keeps original learning while starting a new goal and exposes keyboard step focus', async () => {
    await begin()
    await userEvent.type(screen.getByRole('textbox', { name: '메모' }), '첫 목표의 설명')
    await userEvent.click(screen.getByText('기록·새 질문'))
    await userEvent.click(screen.getByRole('button', { name: '새 질문으로 시작' }))
    const goal = screen.getByRole('textbox', { name: '이번에 확인할 질문' })
    await userEvent.clear(goal); await userEvent.type(goal, '대기 위치를 다시 비교하고 싶다')
    await userEvent.click(await supplementButton())
    expect(step('차이 비교하기')).not.toHaveProperty('disabled', true)
    step('차이 비교하기').focus(); await userEvent.keyboard('{Enter}')
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: '연결을 매번 만들 때와 재사용할 때의 차이' }))
    await waitFor(() => {
      const state = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)
      expect(Object.keys(state.sessionsById)).toHaveLength(2)
      expect(Object.values(state.sessionsById).some((session: unknown) => JSON.stringify(session).includes('첫 목표의 설명'))).toBe(true)
    })
  })

  it('snapshots a transfer explanation without keyword grading or erasing earlier attempts', async () => {
    await begin(); await userEvent.click(step('새 조건 설명하기'))
    const editor = screen.getByRole('textbox', { name: '내 선택과 그 이유' })
    await userEvent.type(editor, '전체 상한은 16이지만 처리 성능은 별도로 봐야 한다.')
    await userEvent.click(screen.getByRole('button', { name: /설명 저장하고/ }))
    await userEvent.click(step('새 조건 설명하기'))
    await userEvent.type(screen.getByRole('textbox', { name: '내 선택과 그 이유' }), ' 대기 위치도 확인한다.')
    await userEvent.click(screen.getByRole('button', { name: /설명 저장하고/ }))
    await waitFor(() => {
      const state = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)
      const attempts = state.sessionsById[state.currentSessionId].attempts
      expect(attempts).toHaveLength(2)
      expect(attempts[0].text).not.toContain('대기 위치도')
      expect(attempts[1].text).toContain('대기 위치도')
    })
    await userEvent.click(step('새 조건 설명하기'))
    await userEvent.click(screen.getByText('내 설명과 판단 근거 비교하기'))
    expect(screen.getByText(/모든 서버의 최대 연결 수는 2×4=8개에서 4×4=16개로/)).toBeTruthy()
    expect(screen.queryByText(/100점|숙련도|정답입니다/)).toBeNull()
  })

  it('follows an accepted check-first order after submission without replacing old answers or attempts', async () => {
    const state = seedSession('기존 원리 메모')
    const selected = state.sessionsById[state.currentSessionId!]
    selected.currentActivity = 'check'
    selected.activityOrder = ['check', 'explain', 'compare', 'experiment', 'reflect']
    selected.answers.check = { text: '새 서버 수에 맞춰 전체 연결 예산을 다시 확인한다.', updatedAt: stamp }
    selected.attempts = [{ id: 'previous-attempt', activity: 'check', text: '이전 설명은 그대로 남긴다.', at: stamp }]
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state))
    render(<StudyPoc />)
    await screen.findByRole('heading', { name: '서버가 2대에서 4대로 늘면?' })
    await userEvent.click(screen.getByRole('button', { name: '설명 저장하고 풀의 역할 읽기 →' }))
    const title = screen.getByRole('heading', { name: '커넥션 풀은 연결을 어떻게 관리할까?' })
    expect(document.activeElement).toBe(title)
    expect(within(screen.getByRole('navigation', { name: '현재 학습과 단계' })).getAllByRole('button')).toHaveLength(5)
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)
      const current = saved.sessionsById[saved.currentSessionId]
      expect(current.currentActivity).toBe('explain')
      expect(current.activityOrder).toEqual(['check', 'explain', 'compare', 'experiment', 'reflect'])
      expect(current.answers.explain.text).toBe('기존 원리 메모')
      expect(current.attempts[0]).toEqual(selected.attempts[0])
      expect(current.attempts[1].text).toBe('새 서버 수에 맞춰 전체 연결 예산을 다시 확인한다.')
    })
  })

  it('distinguishes answer-excluded attempt history from restored explanation bodies', async () => {
    const state = seedSession()
    const current = state.sessionsById[state.currentSessionId!]
    current.currentActivity = 'check'
    current.attempts = [{ id: 'metadata-only-attempt', activity: 'check', at: stamp }]
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(state))
    render(<StudyPoc />)
    await screen.findByRole('heading', { name: '서버가 2대에서 4대로 늘면?' })
    await userEvent.click(screen.getByText('이전에 남긴 설명 확인'))
    expect(screen.getByText('저장한 내용 0개 · 내용 없는 시도 기록 1개')).toBeTruthy()
    expect(screen.getByText(/작성한 내용 없이 시도 기록만 남아 있습니다/)).toBeTruthy()
    expect(screen.queryByText(/이전 설명도 기록에 보존됩니다/)).toBeNull()
  })

  it('keeps rules proposals neutral even when fallback diagnostics indicate a provider attempt', async () => {
    seedSession('PRIVATE_ANSWER_NOT_SENT')
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(init?.body as string)
      expect(JSON.stringify(body)).not.toContain('PRIVATE_ANSWER_NOT_SENT')
      return new Response(JSON.stringify({ ...body, mode: 'rules', activityIds: ['experiment', 'compare'], reason: '조건을 먼저 바꾸며 비교해 보세요.', sourceIds: ['hikari-sizing'], fallbackReason: 'live_disabled', diagnostics: { attempts: 1 } }), { status: 200 })
    })
    render(<StudyPoc />); await screen.findByRole('heading', { name: '커넥션 풀은 연결을 어떻게 관리할까?' })
    await userEvent.click(screen.getByText('학습 순서 추천'))
    await userEvent.click(screen.getByRole('button', { name: '학습 순서 추천받기' }))
    const accept = await screen.findByRole('button', { name: '이 순서로 공부하기' })
    expect(screen.getByRole('heading', { name: '커넥션 풀은 연결을 어떻게 관리할까?' })).toBeTruthy()
    expect(screen.getByText('기본 추천')).toBeTruthy()
    expect(screen.queryByText(/AI 호출 없음|AI를 호출하지 않은|live_disabled/)).toBeNull()
    await userEvent.click(accept)
    expect(screen.getByRole('heading', { name: '연결 수를 바꿔 대기를 확인하세요' })).toBeTruthy()
    await waitFor(() => {
      const state = JSON.parse(localStorage.getItem(WORKSPACE_KEY)!)
      expect(state.sessionsById[state.currentSessionId].activityOrder.slice(0, 2)).toEqual(['experiment', 'compare'])
      expect(state.sessionsById[state.currentSessionId].answers.explain.text).toBe('PRIVATE_ANSWER_NOT_SENT')
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('ignores a late response after explicit cancellation', async () => {
    seedSession()
    let resolve!: (value: Response) => void
    let body: Record<string, unknown> = {}
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => { body = JSON.parse(init?.body as string); return new Promise((done) => { resolve = done }) })
    render(<StudyPoc />); await screen.findByRole('heading', { name: '커넥션 풀은 연결을 어떻게 관리할까?' })
    await userEvent.click(screen.getByText('학습 순서 추천'))
    await userEvent.click(screen.getByRole('button', { name: '학습 순서 추천받기' }))
    await userEvent.click(screen.getByRole('button', { name: '추천 취소' }))
    resolve(new Response(JSON.stringify({ ...body, mode: 'ai', activityIds: ['check'], reason: 'late proposal', sourceIds: [] }), { status: 200 }))
    await waitFor(() => expect(screen.queryByRole('button', { name: '이 순서로 공부하기' })).toBeNull())
    expect(screen.getByRole('heading', { name: '커넥션 풀은 연결을 어떻게 관리할까?' })).toBeTruthy()
    expect(screen.getByText('추천을 취소했습니다.')).toBeTruthy()
  })

  it('backs up the scoped workspace with explicit answer inclusion and previews before restore', async () => {
    const state = seedSession('PRIVATE_BACKUP_ANSWER')
    render(<StudyPoc />); await screen.findByRole('heading', { name: '커넥션 풀은 연결을 어떻게 관리할까?' })
    await userEvent.click(screen.getByText('학습 기록 백업·복원'))
    await userEvent.click(screen.getByRole('button', { name: '학습 기록 백업 만들기' }))
    const field = screen.getByRole('textbox', { name: '백업 내용(JSON)' }) as HTMLTextAreaElement
    expect(field.value).not.toContain('PRIVATE_BACKUP_ANSWER')
    await userEvent.click(screen.getByRole('checkbox', { name: '메모·답변 포함' }))
    await userEvent.click(screen.getByRole('button', { name: '학습 기록 백업 만들기' }))
    expect(field.value).toContain('PRIVATE_BACKUP_ANSWER')
    const exported = exportWorkspace(state, true)
    cleanup(); localStorage.clear(); render(<StudyPoc />)
    await screen.findByRole('heading', { name: 'DB 연결부터 살펴보기' })
    await userEvent.click(screen.getByText('학습 기록 백업·복원'))
    fireEvent.change(screen.getByRole('textbox', { name: '백업 내용(JSON)' }), { target: { value: exported } })
    await userEvent.click(screen.getByRole('button', { name: '백업 내용 확인하기' }))
    expect(localStorage.getItem(WORKSPACE_KEY)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '현재 기록에 합치기' }))
    expect(await screen.findByRole('heading', { name: '커넥션 풀은 연결을 어떻게 관리할까?' })).toBeTruthy()
    await openNotes()
    expect((screen.getByRole('textbox', { name: '메모' }) as HTMLTextAreaElement).value).toBe('PRIVATE_BACKUP_ANSWER')
  })

  it('preserves unsupported raw bytes and foreign legacy records', async () => {
    const malformed = '{unsupported-private-workspace'
    localStorage.setItem(WORKSPACE_KEY, malformed)
    localStorage.setItem('csqt.answer-practice.v2', 'LEGACY_UNTOUCHED')
    const setter = vi.spyOn(localStorage, 'setItem')
    render(<StrictMode><StudyPoc /></StrictMode>)
    const start = await supplementButton()
    expect(start).toHaveProperty('disabled', true)
    expect(screen.getByRole('alert').textContent).toContain('기존 기록은 변경하지 않았습니다')
    expect(setter).not.toHaveBeenCalled()
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(malformed)
    expect(localStorage.getItem('csqt.answer-practice.v2')).toBe('LEGACY_UNTOUCHED')
    await userEvent.click(screen.getByText('학습 기록 백업·복원'))
    await userEvent.click(screen.getByRole('button', { name: '복구용 저장 내용 보기' }))
    expect((screen.getByRole('textbox', { name: '복구용 저장 내용 · 읽을 수 없는 기록' }) as HTMLTextAreaElement).value).toBe(malformed)
    expect(setter).not.toHaveBeenCalled()
  })

  it('keeps in-progress input visible and stops writes when another tab changes the workspace', async () => {
    await begin()
    const editor = screen.getByRole('textbox', { name: '메모' }) as HTMLTextAreaElement
    await userEvent.type(editor, '작성 중인 설명')
    await saved()
    window.dispatchEvent(new StorageEvent('storage', { key: WORKSPACE_KEY, newValue: 'other-tab-content' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('다른 탭에서 기록이 바뀌어 저장을 멈췄습니다'))
    expect(editor.value).toBe('작성 중인 설명')
    expect(editor).toHaveProperty('readOnly', true)
  })
})
