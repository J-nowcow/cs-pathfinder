/** @vitest-environment happy-dom */
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResumeQuestionMaker } from '@/components/ResumeQuestionMaker'
import {
  deserializeResumeQuestions,
  RESUME_QUESTIONS_STORAGE_KEY,
} from '@/lib/personalize/resume-storage'

const authState = vi.hoisted(() => ({
  data: null as null | { user: { email: string } },
  isPending: false,
}))

vi.mock('@/lib/auth/client', () => ({
  authClient: { useSession: () => authState },
}))

const questions = [
  { text: '캐시 무효화 시점은 어떻게 정했는가?', basis: '캐시로 응답 지연을 줄인 경험', topic: '캐시' },
  { text: '동시 요청의 정합성은 어떻게 지켰는가?', basis: '동시 요청을 처리한 경험', topic: '동시성' },
  { text: '장애 전파 범위는 어떻게 줄였는가?', basis: '외부 시스템 장애에 대응한 경험', topic: '장애 격리' },
  { text: '성능 개선은 어떤 지표로 확인했는가?', basis: '처리 성능을 측정하고 개선한 경험', topic: '성능 측정' },
  { text: '트래픽이 늘면 어디가 먼저 막히는가?', basis: '트래픽 증가를 고려한 설계 경험', topic: '확장성' },
]

describe('레쥬메 맞춤 질문 화면', () => {
  beforeEach(() => {
    authState.data = null
    authState.isPending = false
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('로그인 전에는 계정 영역으로 안내한다', () => {
    render(<ResumeQuestionMaker />)
    expect(screen.getByRole('link', { name: '로그인하러 가기' }).getAttribute('href')).toBe('#account')
    expect(screen.queryByLabelText('레쥬메 내용')).toBeNull()
  })

  it('생성 중 동작을 보여주고 원문 없이 질문 5개만 보존한다', async () => {
    authState.data = { user: { email: 'user@example.com' } }
    let finish: ((value: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve
          }),
      ),
    )
    const user = userEvent.setup()
    render(<ResumeQuestionMaker />)
    const source = '서버 캐시와 동시성을 개선한 경험이 있습니다. '.repeat(6)
    await user.type(screen.getByLabelText('레쥬메 내용'), source)
    await user.click(screen.getByRole('button', { name: '맞춤 질문 5개 만들기' }))

    expect(screen.getByRole('status').textContent).toContain('기술 근거를 찾는 중')
    await act(async () => {
      finish?.(
        new Response(JSON.stringify({ questions, quota: { used: 1, limit: 3 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    })

    expect(await screen.findByRole('heading', { name: '맞춤 질문 5개' })).not.toBeNull()
    expect(screen.getAllByRole('link', { name: /관련 질문 찾기/ })).toHaveLength(5)
    const saved = deserializeResumeQuestions(
      window.localStorage.getItem(RESUME_QUESTIONS_STORAGE_KEY),
    )
    expect(saved?.questions).toEqual(questions)
    expect(window.localStorage.getItem(RESUME_QUESTIONS_STORAGE_KEY)).not.toContain(source)
  })

  it('저장된 질문을 직접 지울 수 있다', async () => {
    window.localStorage.setItem(
      RESUME_QUESTIONS_STORAGE_KEY,
      JSON.stringify({ version: 1, createdAt: '2026-08-13T00:00:00.000Z', questions }),
    )
    const user = userEvent.setup()
    render(<ResumeQuestionMaker />)
    expect(await screen.findByText(questions[0].text)).not.toBeNull()
    await user.click(screen.getByRole('button', { name: '질문 지우기' }))
    expect(window.localStorage.getItem(RESUME_QUESTIONS_STORAGE_KEY)).toBeNull()
    expect(screen.queryByText(questions[0].text)).toBeNull()
  })
})
