import { describe, expect, it } from 'vitest'
import { BODY, createWebLesson, webFrame, webLessonReducer, canSendRequest, requestFrames } from '@/components/web-request/model'

function finish(state = createWebLesson()) { const sent = webLessonReducer(state, { type: 'send' }); return webLessonReducer(sent, { type: 'seek', cursor: sent.frames.length - 1 }) }
describe('web request event model', () => {
  it('keeps HTTP and SQL resource lifetimes separate through two serial requests', () => {
    let state = createWebLesson()
    state = finish(state)
    expect(webFrame(state)).toMatchObject({ phase: 'received', request: 1, sqlCount: 1, borrowCount: 1, web: 'open', db: 'idle', browserBody: BODY })
    const firstResult = state.frames.find((frame) => frame.phase === 'result')!
    expect(firstResult).toMatchObject({ db: 'borrowed', browserBody: null })
    expect(state.frames.find((frame) => frame.phase === 'release')).toMatchObject({ db: 'idle', browserBody: null })
    expect(state.frames.find((frame) => frame.phase === 'response')).toMatchObject({ browserBody: null, web: 'open', db: 'idle' })
    state = finish(state)
    expect(webFrame(state)).toMatchObject({ request: 2, sqlCount: 2, borrowCount: 2, browserBody: BODY })
    expect(canSendRequest(state)).toBe(false)
  })
  it('rejects another request or mode mutation while a request is being observed', () => {
    const state = webLessonReducer(createWebLesson(), { type: 'send' })
    expect(webLessonReducer(state, { type: 'send' })).toBe(state)
    expect(webLessonReducer(state, { type: 'mode', mode: 'constant' })).toBe(state)
    expect(webLessonReducer(state, { type: 'close' })).toBe(state)
    expect(webLessonReducer(state, { type: 'seek', cursor: Number.NaN })).toBe(state)
  })
  it('skips DB events for a constant handler and resets comparison counters', () => {
    const state = finish(webLessonReducer(finish(), { type: 'mode', mode: 'constant' }))
    expect(state.frames.map((frame) => frame.phase)).toEqual(['ready', 'request', 'handler', 'response', 'received'])
    expect(webFrame(state)).toMatchObject({ sqlCount: 0, borrowCount: 0, browserBody: BODY })
    expect(state.frames.every((frame) => frame.db === 'idle')).toBe(true)
  })
  it('closes only W1 and requires a fresh example before sending again', () => {
    const state = webLessonReducer(finish(), { type: 'close' })
    expect(webFrame(state)).toMatchObject({ phase: 'closed', web: 'closed', db: 'idle', sqlCount: 1, borrowCount: 1, browserBody: BODY })
    expect(webLessonReducer(state, { type: 'send' })).toBe(state)
    expect(webLessonReducer(state, { type: 'reset' })).toEqual(createWebLesson())
  })
  it('keeps earlier snapshots independent and bounds the observation clock', () => {
    const initial = createWebLesson(); const snapshot = JSON.stringify(initial)
    const sent = webLessonReducer(initial, { type: 'send' })
    expect(JSON.stringify(initial)).toBe(snapshot)
    expect(webFrame(webLessonReducer(sent, { type: 'seek', cursor: 999 }))).toEqual(sent.frames.at(-1))
    expect(webFrame(webLessonReducer(sent, { type: 'seek', cursor: -10 }))).toEqual(sent.frames[0])
    expect(() => requestFrames(sent.frames[1], 'database')).toThrow('request_not_ready')
  })
})
