/** Selected HTTP/1.1 events. No network, database, timing or persistence. */
export type HandlerMode = 'database' | 'constant'
export type WebPhase = 'ready' | 'request' | 'handler' | 'borrow' | 'sql' | 'result' | 'release' | 'response' | 'received' | 'closed'
export type WebFrame = {
  phase: WebPhase
  request: number
  web: 'open' | 'closed'
  db: 'idle' | 'borrowed'
  sqlCount: number
  borrowCount: number
  browserBody: string | null
}
export type WebLesson = { mode: HandlerMode; frames: WebFrame[]; cursor: number }
export type WebAction = { type: 'send' } | { type: 'next' } | { type: 'seek'; cursor: number } | { type: 'close' } | { type: 'mode'; mode: HandlerMode } | { type: 'reset' }
export const REQUEST = 'GET /counters/7'
export const SQL = 'SELECT value FROM counters WHERE id = 7'
export const BODY = '{"value":0}'
export const HTTP_RESPONSE = `200 OK\n${BODY}`

export function createWebLesson(mode: HandlerMode = 'database'): WebLesson {
  return { mode, cursor: 0, frames: [{ phase: 'ready', request: 0, web: 'open', db: 'idle', sqlCount: 0, borrowCount: 0, browserBody: null }] }
}
export const webFrame = (state: WebLesson) => state.frames[state.cursor]
export const isWebSettled = (state: WebLesson) => state.cursor === state.frames.length - 1 && ['ready', 'received', 'closed'].includes(webFrame(state).phase)
export const canSendRequest = (state: WebLesson) => isWebSettled(state) && webFrame(state).web === 'open' && webFrame(state).request < 2

export function requestFrames(previous: WebFrame, mode: HandlerMode): WebFrame[] {
  if (previous.web !== 'open' || previous.db !== 'idle' || !['ready', 'received'].includes(previous.phase) || previous.request >= 2) throw new Error('request_not_ready')
  let current: WebFrame = { ...previous, request: previous.request + 1, browserBody: null }
  const frames: WebFrame[] = []
  const add = (phase: WebPhase, change: Partial<WebFrame> = {}) => { current = { ...current, phase, ...change }; frames.push(current) }
  add('request')
  add('handler')
  if (mode === 'database') {
    add('borrow', { db: 'borrowed', borrowCount: current.borrowCount + 1 })
    add('sql', { sqlCount: current.sqlCount + 1 })
    add('result')
    add('release', { db: 'idle' })
  }
  add('response')
  add('received', { browserBody: BODY })
  return frames
}
export function webLessonReducer(state: WebLesson, action: WebAction): WebLesson {
  switch (action.type) {
    case 'send': {
      if (!canSendRequest(state)) return state
      const frames = [...state.frames, ...requestFrames(webFrame(state), state.mode)]
      return { ...state, frames, cursor: state.cursor + 1 }
    }
    case 'next': return { ...state, cursor: Math.min(state.cursor + 1, state.frames.length - 1) }
    case 'seek': return Number.isFinite(action.cursor) ? { ...state, cursor: Math.max(0, Math.min(state.frames.length - 1, Math.trunc(action.cursor))) } : state
    case 'close': return isWebSettled(state) && webFrame(state).phase === 'received' ? { ...state, frames: [...state.frames, { ...webFrame(state), phase: 'closed', web: 'closed' }], cursor: state.cursor + 1 } : state
    case 'mode': return isWebSettled(state) ? createWebLesson(action.mode) : state
    case 'reset': return createWebLesson(state.mode)
  }
}
export function webCaption(frame: WebFrame, mode: HandlerMode): string {
  switch (frame.phase) {
    case 'ready': return 'W1은 열려 있고 C1은 풀에서 사용할 수 있습니다.'
    case 'request': return `R${frame.request}의 HTTP 조회 요청이 W1을 따라 앱 서버로 갑니다.`
    case 'handler': return mode === 'database' ? '앱 코드가 주소의 7을 읽어 조회할 행의 id로 사용합니다.' : '이 앱 코드는 DB를 읽지 않고 숫자 0을 응답에 넣습니다.'
    case 'borrow': return `앱이 풀에서 C1을 빌려 R${frame.request}의 조회에 사용합니다.`
    case 'sql': return '앱이 만든 SELECT가 C1을 따라 DB로 갑니다.'
    case 'result': return 'DB가 찾은 숫자 0이 C1을 따라 앱으로 돌아옵니다.'
    case 'release': return '앱이 결과 0을 받은 뒤 C1을 풀에 반납했습니다.'
    case 'response': return '앱이 정상 처리 상태 200과 본문 {"value":0}을 W1으로 보냅니다.'
    case 'received': return `브라우저가 R${frame.request}의 응답을 받았고 W1은 다음 요청에도 쓸 수 있습니다.`
    case 'closed': return '웹 연결 W1만 닫았습니다. DB 연결 C1은 풀에 남아 있습니다.'
  }
}
