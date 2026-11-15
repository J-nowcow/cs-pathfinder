// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectionIntro } from '@/components/study-poc/ConnectionIntro'
import { advanceIntro, INTRO_CHAPTERS, INTRO_SAMPLE, INTRO_SELECT } from '@/components/study-poc/connection-intro'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
const next = () => fireEvent.click(screen.getByRole('button', { name: /다음 장면|다음 주제/ }))
const pool = () => screen.getByRole('region', { name: '풀의 DB 연결' })
const db = () => screen.getByRole('region', { name: 'DB의 SQL 실행' })

describe('connection introduction', () => {
  it('retains one connection across SQL completion, return and reuse by a different request', () => {
    render(<ConnectionIntro />)
    expect(pool().textContent).toContain('아직 연결 없음')
    expect(screen.getByRole('heading', { name: 'DB · 데이터 저장소' })).toBeTruthy()
    expect(db().textContent).toContain('자료 한 건(행)')
    expect(db().textContent).toContain(`id(구분 번호) = ${INTRO_SAMPLE.id}`)
    expect(db().textContent).toContain(`value(저장 숫자) = ${INTRO_SAMPLE.value}`)
    next(); expect(pool().textContent).toContain('연결 중')
    next(); expect(pool().textContent).toContain('C1사용 가능 · idle')
    const connection = pool().querySelector('.sp-intro-connection')
    next(); expect(pool().textContent).toContain('R1에 빌려줌'); expect(db().textContent).toContain('R1의 SQL'); expect(db().textContent).toContain(INTRO_SELECT)
    next(); expect(pool().textContent).toContain('사용 중 · busy'); expect(db().textContent).toContain('실행 중인 SQL 없음')
    expect(screen.getByRole('region', { name: '앱의 요청' }).textContent).toContain('R1 조회 결과 · value = 0')
    next(); expect(pool().textContent).toContain('사용 가능 · idle')
    next(); next(); next()
    expect(pool().querySelector('.sp-intro-connection')).toBe(connection)
    expect(pool().textContent).toContain('C1사용 중 · busyR2에 빌려줌')
    expect(db().textContent).toContain('R2의 SQL')
  })

  it('keeps R2 waiting until R1 returns C1, then assigns that same connection', () => {
    render(<ConnectionIntro />)
    for (let index = 0; index < 11; index++) next()
    expect(screen.getByRole('heading', { name: '모두 사용 중이면 대기' })).toBeTruthy()
    next()
    const requests = screen.getByRole('region', { name: '앱의 요청' })
    expect(pool().textContent).toContain('최대 연결 1개')
    expect(requests.textContent).toContain('R2연결 기다림')
    expect(db().textContent).toContain('R1의 SQL')
    next(); expect(requests.textContent).toContain('R2연결 기다림'); expect(pool().textContent).toContain('R1에 빌려줌')
    next(); expect(requests.textContent).toContain('R2연결 기다림'); expect(pool().textContent).toContain('사용 가능 · idle')
    next(); expect(requests.textContent).toContain('R2C1 사용 중'); expect(db().textContent).toContain('R2의 SQL')
    next(); expect(pool().textContent).toContain('R2에 빌려줌')
    next(); expect(pool().textContent).toContain('사용 가능 · idle')
  })

  it('plays a finite chapter, pauses without advancing, resets, and clears timers on unmount', () => {
    vi.useFakeTimers()
    const view = render(<ConnectionIntro />)
    fireEvent.click(screen.getByRole('button', { name: '재생' }))
    act(() => { vi.advanceTimersByTime(3000) })
    expect(pool().textContent).toContain('연결 중')
    fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
    expect(pool().closest('.sp-intro-scene')?.getAttribute('data-motion-paused')).toBe('true')
    act(() => { vi.advanceTimersByTime(10000) })
    expect(pool().textContent).toContain('연결 중')
    fireEvent.click(screen.getByRole('button', { name: '다시 보기' }))
    expect(pool().textContent).toContain('아직 연결 없음')
    expect(pool().closest('.sp-intro-scene')?.getAttribute('data-motion-paused')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: '재생' }))
    for (let index = 0; index < 5; index++) act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('button', { name: '이 장면 재생' })).toBeTruthy()
    act(() => { vi.advanceTimersByTime(20000) })
    expect(screen.getByRole('heading', { name: 'DB 연결' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '이 장면 재생' }))
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('starts reduced motion as static steps, supports keyboard steps and permits direct experiment entry', () => {
    const query = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    vi.spyOn(window, 'matchMedia').mockReturnValue(query as unknown as MediaQueryList)
    const experiment = vi.fn()
    render(<ConnectionIntro onExperiment={experiment} />)
    expect(screen.getByRole('button', { name: '재생' })).toHaveProperty('disabled', true)
    const forward = screen.getByRole('button', { name: '다음 장면' })
    fireEvent.keyDown(forward, { key: 'ArrowRight' })
    expect(pool().textContent).toContain('연결 중')
    fireEvent.keyDown(forward, { key: 'ArrowLeft' })
    expect(pool().textContent).toContain('아직 연결 없음')
    fireEvent.click(screen.getByRole('button', { name: '풀 크기 실험으로 이동 →' }))
    expect(experiment).toHaveBeenCalledTimes(1)
    expect(within(screen.getByRole('region', { name: 'DB 연결과 풀의 동작' })).queryByRole('slider')).toBeNull()
  })

  it('keeps middle-step focus and focuses the heading at both manual boundaries', () => {
    render(<ConnectionIntro />)
    const forward = screen.getByRole('button', { name: '다음 장면' })
    forward.focus(); next()
    expect(document.activeElement).toBe(forward)
    const previous = screen.getByRole('button', { name: '이전 장면' })
    previous.focus(); fireEvent.click(previous)
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'DB 연결' }))
    let remaining = INTRO_CHAPTERS.reduce((total, chapter) => total + chapter.frames.length, 0) - 1
    while (remaining-- > 0) next()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: '모두 사용 중이면 대기' }))
  })
  it('bounds manual navigation at both ends without looping', () => {
    let position = { chapter: 0, frame: 0 }
    expect(advanceIntro(position, -1)).toBe(position)
    for (let index = 0; index < 100; index++) position = advanceIntro(position, 1)
    expect(position).toEqual({ chapter: 2, frame: INTRO_CHAPTERS[2].frames.length - 1 })
    expect(advanceIntro(position, 1)).toBe(position)
  })
})
