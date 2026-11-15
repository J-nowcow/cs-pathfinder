'use client'

import { useEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react'
import { BODY, HTTP_RESPONSE, REQUEST, SQL, canSendRequest, createWebLesson, isWebSettled, webCaption, webFrame, webLessonReducer, type HandlerMode, type WebPhase } from './model'
import './web-request.css'

const PHASE_LABEL: Record<WebPhase, string> = { ready: '요청 전', request: 'HTTP 요청 전송', handler: '앱 코드 실행', borrow: 'C1 빌리기', sql: 'SQL 전송', result: '조회 결과 반환', release: 'C1 반납', response: 'HTTP 응답 전송', received: '브라우저 수신 완료', closed: 'W1 닫힘' }
const DATABASE_CODE = [REQUEST, 'id = 7  // 주소에서 읽은 값', 'C1 = pool.borrow()', 'value = C1.query(SELECT … WHERE id = 7)', 'C1.release()', 'return HTTP(200, {"value": value})']
const CONSTANT_CODE = [REQUEST, 'return HTTP(200, {"value": 0})']
const CODE_LINE: Partial<Record<WebPhase, number>> = { handler: 1, borrow: 2, sql: 3, result: 3, release: 4, response: 5, received: 5 }

export function WebRequestLesson() {
  const [state, dispatch] = useReducer(webLessonReducer, undefined, () => createWebLesson())
  const [playing, setPlaying] = useState(false)
  const [motionPaused, setMotionPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [hasCompletedDatabase, setHasCompletedDatabase] = useState(false)
  const [comparison, setComparison] = useState(false)
  const [choice, setChoice] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const comparisonBar = useRef<HTMLFieldSetElement>(null)
  const focusHeading = useRef(false)
  const focusComparison = useRef(false)
  const frame = webFrame(state)
  const atEnd = state.cursor === state.frames.length - 1
  const settled = isWebSettled(state)
  const canSend = canSendRequest(state)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { setReduced(query.matches); if (query.matches) setPlaying(false) }
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!playing || reduced || atEnd) return
    const timer = window.setTimeout(() => dispatch({ type: 'next' }), 2200)
    return () => window.clearTimeout(timer)
  }, [playing, reduced, state.cursor, atEnd])
  useEffect(() => { if (atEnd) setPlaying(false) }, [atEnd])
  useEffect(() => { if (state.mode === 'database' && frame.phase === 'received') setHasCompletedDatabase(true) }, [state.mode, frame.phase])
  useEffect(() => { if (focusHeading.current) { heading.current?.focus(); focusHeading.current = false } }, [state.cursor, state.mode, state.frames])
  useEffect(() => { if (comparison && focusComparison.current) { comparisonBar.current?.querySelector<HTMLInputElement>('input')?.focus(); focusComparison.current = false } }, [comparison])
  function send() { if (!canSend) return; focusHeading.current = true; setMotionPaused(false); dispatch({ type: 'send' }); setPlaying(!reduced) }
  function seek(cursor: number) { setPlaying(false); setMotionPaused(false); dispatch({ type: 'seek', cursor }) }
  function step(delta: -1 | 1) { const next = Math.max(0, Math.min(state.frames.length - 1, state.cursor + delta)); focusHeading.current = next !== state.cursor && (next === 0 || next === state.frames.length - 1); seek(next) }
  function reset() { setPlaying(false); setMotionPaused(false); focusHeading.current = true; dispatch({ type: 'reset' }) }
  function mode(mode: HandlerMode) { setPlaying(false); setMotionPaused(false); dispatch({ type: 'mode', mode }) }
  function openComparison() { if (!settled) return; setFeedback(true); focusComparison.current = true; setComparison(true) }
  function keyboard(event: KeyboardEvent<HTMLElement>) { if (event.target instanceof HTMLButtonElement && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1) } }
  const code = state.mode === 'database' ? DATABASE_CODE : CONSTANT_CODE
  const activeLine = state.mode === 'database' ? CODE_LINE[frame.phase] : ['handler', 'response', 'received'].includes(frame.phase) ? 1 : undefined
  const outbound = frame.phase === 'request'
  const inbound = frame.phase === 'response'
  const sql = frame.phase === 'sql'
  const result = frame.phase === 'result'
  return <div className="study-poc wr-lesson" data-web-request-interactive="true" onKeyDown={keyboard}>
    <a className="sp-skip" href="#wr-main">학습 내용으로 건너뛰기</a>
    <header className="sp-top"><a href="/" className="sp-brand">CS 길라잡이</a><nav className="sp-public-nav" aria-label="학습 메뉴"><a href="/#desk-shelf-title">공부 자료</a><a href="/learn/db-connections">DB 연결·잠금·대기</a></nav></header>
    <main className="sp-shell" id="wr-main">
      <h1 className="sp-title">조회 버튼을 누르면 DB까지 어떻게 갈까?</h1>
      <p className="wr-intro">HTTP는 브라우저와 앱 서버가 요청·응답을 주고받는 규칙입니다. 앱 서버는 요청을 받아 코드를 실행하는 프로그램입니다.</p>
      <h2 className="wr-scene-heading" tabIndex={-1} ref={heading}>{PHASE_LABEL[frame.phase]}</h2>
      <p className="wr-connections">웹 연결 <strong>W1 · 브라우저 ↔ 앱 서버</strong><span>DB 연결 <strong>C1 · 앱 서버 ↔ DB</strong></span></p>
      {comparison && <fieldset className="wr-comparison" ref={comparisonBar}><legend>같은 요청을 처리하는 서버 코드</legend><label><input type="radio" name="wr-mode" checked={state.mode === 'database'} disabled={!settled} onChange={() => mode('database')} />DB에서 값 읽기</label><label><input type="radio" name="wr-mode" checked={state.mode === 'constant'} disabled={!settled} onChange={() => mode('constant')} />코드의 고정값 0 보내기</label><small>코드를 바꾸면 준비된 연결에서 새 예시를 시작하며 횟수도 초기화됩니다.</small></fieldset>}
      <div className="wr-scene" data-motion-paused={motionPaused}>
        <section className="wr-browser" aria-label="브라우저"><h3>브라우저</h3><p>HTTP 요청 · 서버에 보내는 요청</p><code>{REQUEST}</code><small>GET · 조회 요청</small><button type="button" className="sp-primary" disabled={!canSend} onClick={send}>{frame.web === 'closed' ? 'W1이 닫혀 있습니다' : frame.request >= 2 ? '두 요청을 보냈습니다' : frame.request === 0 ? '조회 요청 보내기' : '같은 W1으로 두 번째 요청 보내기'}</button><div className="wr-received"><strong>받은 HTTP 응답 · 서버가 돌려준 결과</strong>{frame.browserBody ? <><span>200 · 정상 처리</span><code>{frame.browserBody}</code><small>본문의 value에 담긴 숫자는 0입니다.</small></> : <span>아직 받지 않았습니다</span>}</div></section>
        <div className="wr-wire wr-web-wire" data-closed={frame.web === 'closed'} aria-label={`W1 웹 연결 ${frame.web === 'open' ? '열림' : '닫힘'}`}><strong>W1</strong><span>{frame.web === 'open' ? '열림' : '닫힘'}</span><i />{(outbound || inbound) && <b key={`${state.cursor}-${state.mode}`} className={`wr-token ${inbound ? 'wr-token-back' : ''}`} aria-hidden="true">{outbound ? `R${frame.request} 요청` : '200 응답'}</b>}</div>
        <section className="wr-app" aria-label="앱 서버의 처리 코드"><h3>앱 서버</h3><p>풀은 연결을 보관하고 빌려주는 앱의 구성 요소입니다.</p><h4 className="wr-code-label">동작 순서를 보여주는 설명용 코드</h4><ol className="wr-code" aria-label="서버 처리 순서 · 의사코드" title="동작 순서를 보여주는 설명용 코드">{code.map((line, index) => <li key={line} data-active={activeLine === index}><code>{line}</code></li>)}</ol><div className="wr-app-result">{['release', 'response', 'received', 'closed'].includes(frame.phase) ? <><span>JSON 응답 본문 · 담을 데이터</span><code>{BODY}</code></> : frame.phase === 'result' ? <span className="wr-arrival">앱이 조회 결과 0을 받습니다.</span> : <span>JSON · 데이터를 텍스트로 표현하는 형식</span>}</div>{frame.phase === 'response' && <code className="wr-http">HTTP 응답 · {HTTP_RESPONSE}</code>}</section>
        <div className="wr-wire wr-db-wire" aria-label={`C1 DB 연결 ${frame.db === 'idle' ? '사용 가능' : '앱이 사용 중'}`}><strong>C1</strong><span>{frame.db === 'idle' ? '사용 가능' : '앱이 사용 중'}</span><i />{(sql || result) && <b key={`${state.cursor}-${state.mode}`} className={`wr-token ${result ? 'wr-token-back' : ''}`} aria-hidden="true">{sql ? 'SELECT' : '결과 0'}</b>}</div>
        <section className="wr-db" aria-label="DB 조회"><h3>DB · 데이터 저장소</h3><p>counters 표의 예시 데이터<br />SQL · DB에 보내는 명령</p><dl><div><dt>id · 행 구분 번호</dt><dd>7</dd></div><div><dt>value · 저장 숫자</dt><dd>0</dd></div></dl><div className="wr-sql">{state.mode === 'database' && ['sql', 'result', 'release', 'response', 'received', 'closed'].includes(frame.phase) ? <><code>{SQL}</code><span>{frame.phase === 'sql' ? '앱에서 SQL을 보내는 중' : '조회 결과 · value = 0'}</span></> : <span>{state.mode === 'constant' ? '이 코드는 DB를 조회하지 않습니다' : '이 요청의 SQL 실행 전'}</span>}</div></section>
      </div>
      <p className="wr-caption" role="status" aria-live="polite" aria-atomic="true">{webCaption(frame, state.mode)}</p>
      <div className="wr-observation" aria-label="실행 횟수"><span>이 예시의 누적 횟수</span><span>보낸 HTTP 요청 <strong>{frame.request}</strong></span><span>C1 대여 <strong>{frame.borrowCount}</strong></span><span>보낸 SELECT <strong>{frame.sqlCount}</strong></span></div>
      <div className="sp-intro-controls"><button type="button" className="sp-secondary" disabled={reduced || state.frames.length === 1 || atEnd} onClick={() => { setMotionPaused(playing); setPlaying(!playing) }}>{playing ? '멈춤' : '재생'}</button><button type="button" className="sp-text-button" onClick={reset}>이 코드로 처음부터 보기</button><div className="sp-intro-step-controls"><button type="button" className="sp-secondary" disabled={state.cursor === 0} onClick={() => step(-1)}>이전 장면</button><button type="button" className="sp-secondary" disabled={atEnd} onClick={() => step(1)}>다음 장면</button></div></div>
      <label className="wr-timeline" htmlFor="wr-timeline">현재 장면 <output>{state.cursor + 1} / {state.frames.length} · {PHASE_LABEL[frame.phase]}</output><input id="wr-timeline" type="range" min={0} max={state.frames.length - 1} value={state.cursor} onChange={(event) => seek(Number(event.target.value))} aria-valuetext={PHASE_LABEL[frame.phase]} /></label>
      {frame.phase === 'received' && settled && <button type="button" className="sp-secondary" onClick={() => { setPlaying(false); focusHeading.current = true; dispatch({ type: 'close' }) }}>웹 연결 W1만 닫기</button>}
      {reduced && <p className="sp-meta">동작 줄이기 설정에 따라 정지 장면으로 시작합니다. 시간선과 이전·다음 장면으로 살펴보세요.</p>}
      {hasCompletedDatabase && !comparison && settled && <section className="wr-prediction" aria-label="새 코드 예측"><h2>다른 서버 코드를 읽어 보세요</h2><p>새 상황에서 <code>GET /version</code>은 아래 코드로 처리합니다.</p><pre><code>{'return HTTP(200, {"version": 1})'}</code></pre><fieldset><legend>이 코드도 DB 연결 C1을 빌려야 할까요?</legend>{['필요하다', '필요하지 않다'].map((label) => <label key={label}><input type="radio" name="wr-predict" checked={choice === label} onChange={() => setChoice(label)} />{label}</label>)}</fieldset><label className="sp-label" htmlFor="wr-reason">요청과 응답이 어느 연결로 오가는지와 그 이유를 적어 보세요</label><textarea className="sp-textarea" id="wr-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /><div className="sp-actions"><button type="button" className="sp-secondary" disabled={choice === null} onClick={openComparison}>이유 확인하고 코드 비교하기</button><button type="button" className="sp-text-button" onClick={openComparison}>예측 건너뛰고 비교하기</button></div></section>}
      {feedback && <details className="sp-optional" open><summary>새 코드의 요청·응답 경로</summary><p>이 /version 코드는 DB를 읽지 않아 C1을 빌리지 않습니다. 요청과 응답은 W1을 사용합니다. 비교 화면의 고정값 0은 서버 코드에 직접 적은 숫자입니다.</p>{reason && <p className="wr-reason">내 이유: {reason}</p>}</details>}
      <details className="sp-optional"><summary>이 예시의 조건과 근거</summary><p>HTTPS로 보호된 HTTP/1.1 연결 W1이 준비된 상태에서 같은 서버에 요청 두 개를 순서대로 보냅니다. 응답 캐시·프록시·동시 요청·실패·재시도는 제외합니다. W1의 HTTP 메시지는 학습을 위해 복호화한 내용으로 표시합니다. DNS·TCP·TLS의 연결 준비 내부는 펼치지 않습니다.</p><p>처음의 W1은 HTTPS로 보호된 HTTP/1.1 연결이며 C1은 사용 가능한 DB 연결로 앱의 풀이 보관 중입니다. 이 코드와 풀 상태에서는 같은 C1을 재배정하고 반납한 뒤 HTTP 응답을 보내는 순서를 선택했습니다. 응답 완료·C1 반납·W1 닫힘은 별도 사건입니다. 장면과 예측은 저장하지 않으며 기존 DB 수업 기록은 바꾸지 않습니다.</p><ul><li><a href="https://node-postgres.com/guides/async-express">node-postgres · HTTP 요청에서 SQL과 응답으로</a></li><li><a href="https://node-postgres.com/features/pooling">node-postgres · 풀 대여와 반납</a></li><li><a href="https://www.rfc-editor.org/rfc/rfc9112.html#section-9.3">HTTP/1.1 · 연결 재사용</a></li></ul></details>
      <div className="sp-actions"><a href="/learn/db-connections">DB 연결·잠금·대기 다시 보기 →</a><a href="/#desk-shelf-title">다른 공부 자료</a></div>
    </main>
  </div>
}
