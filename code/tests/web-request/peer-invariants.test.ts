import { describe, expect, it } from 'vitest'
import {
  canSendRequest,
  createWebLesson,
  isWebSettled,
  webFrame,
  webLessonReducer,
  type WebLesson,
} from '../../src/components/web-request/model'

function finishRequest(state: WebLesson): WebLesson {
  let next = webLessonReducer(state, { type: 'send' })
  for (let guard = 0; !isWebSettled(next) && guard < 20; guard += 1) {
    next = webLessonReducer(next, { type: 'next' })
  }
  expect(isWebSettled(next)).toBe(true)
  expect(webFrame(next).phase).toBe('received')
  return next
}

describe('independent web/DB lesson boundaries', () => {
  it('keeps C1 borrowed after the result, releases separately, and delivers HTTP content later', () => {
    const initial = createWebLesson()
    let state = webLessonReducer(initial, { type: 'send' })
    const currentRequest = state.frames.filter((frame) => frame.request === 1)
    const result = currentRequest.find((frame) => frame.phase === 'result')!
    const release = currentRequest.find((frame) => frame.phase === 'release')!
    const response = currentRequest.find((frame) => frame.phase === 'response')!
    const received = currentRequest.find((frame) => frame.phase === 'received')!
    expect(result.db).toBe('borrowed')
    expect(result.browserBody).toBeNull()
    expect(release.db).toBe('idle')
    expect(release.browserBody).toBeNull()
    expect(response.web).toBe('open')
    expect(response.browserBody).toBeNull()
    expect(received.browserBody).toBe('{"value":0}')
    expect(currentRequest.indexOf(result)).toBeLessThan(currentRequest.indexOf(release))
    expect(currentRequest.indexOf(release)).toBeLessThan(currentRequest.indexOf(response))
    expect(currentRequest.indexOf(response)).toBeLessThan(currentRequest.indexOf(received))
    state = webLessonReducer(state, { type: 'seek', cursor: state.frames.length - 1 })
    expect(webFrame(state)).toMatchObject({ sqlCount: 1, borrowCount: 1, db: 'idle' })
    expect(initial).toEqual(createWebLesson())
  })

  it.each([
    ['database', 2, 2],
    ['constant', 0, 0],
  ] as const)('two %s requests use the chosen handler without conflating identical bodies', (mode, sqlCount, borrowCount) => {
    let state = createWebLesson(mode)
    state = finishRequest(state)
    const firstSnapshot = JSON.stringify(state.frames)
    state = finishRequest(state)
    expect(webFrame(state)).toMatchObject({
      request: 2,
      sqlCount,
      borrowCount,
      db: 'idle',
      web: 'open',
      browserBody: '{"value":0}',
    })
    expect(JSON.stringify(state.frames.slice(0, JSON.parse(firstSnapshot).length))).toBe(firstSnapshot)
    expect(canSendRequest(state)).toBe(false)
    expect(webLessonReducer(state, { type: 'send' })).toBe(state)
    if (mode === 'constant') {
      expect(state.frames.every((frame) => frame.db === 'idle')).toBe(true)
      expect(state.frames.some((frame) => ['borrow', 'sql', 'result', 'release'].includes(frame.phase))).toBe(false)
    }
    const closed = webLessonReducer(state, { type: 'close' })
    expect(webFrame(closed)).toEqual({ ...webFrame(state), phase: 'closed', web: 'closed' })
    expect(canSendRequest(closed)).toBe(false)
    expect(webLessonReducer(closed, { type: 'send' })).toBe(closed)
  })

  it('prevents a second request, handler change, or close while the first exchange is in progress', () => {
    let state = webLessonReducer(createWebLesson(), { type: 'send' })
    for (let guard = 0; !isWebSettled(state) && guard < 20; guard += 1) {
      expect(canSendRequest(state)).toBe(false)
      expect(webLessonReducer(state, { type: 'send' })).toBe(state)
      expect(webLessonReducer(state, { type: 'close' })).toBe(state)
      expect(webLessonReducer(state, { type: 'mode', mode: 'constant' })).toBe(state)
      state = webLessonReducer(state, { type: 'next' })
    }
    expect(isWebSettled(state)).toBe(true)
    const history = webLessonReducer(state, { type: 'seek', cursor: 0 })
    expect(canSendRequest(history)).toBe(false)
    expect(webLessonReducer(history, { type: 'send' })).toBe(history)
  })

  it('starts a new comparison with zero counts and resets without mutating the previous lesson', () => {
    const completed = finishRequest(createWebLesson())
    const before = JSON.stringify(completed)
    const changed = webLessonReducer(completed, { type: 'mode', mode: 'constant' })
    expect(changed).toEqual(createWebLesson('constant'))
    const reset = webLessonReducer(finishRequest(changed), { type: 'reset' })
    expect(reset).toEqual(createWebLesson('constant'))
    expect(JSON.stringify(completed)).toBe(before)
  })

  it('keeps every seek inside existing finite history and ignores non-finite cursors', () => {
    const state = finishRequest(createWebLesson())
    expect(webLessonReducer(state, { type: 'seek', cursor: -20 }).cursor).toBe(0)
    expect(webLessonReducer(state, { type: 'seek', cursor: 1000 }).cursor).toBe(state.frames.length - 1)
    for (const cursor of [NaN, Infinity, -Infinity]) {
      expect(webLessonReducer(state, { type: 'seek', cursor })).toBe(state)
    }
    expect(webLessonReducer(state, { type: 'next' }).cursor).toBe(state.cursor)
  })
})
