'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { LearningPath } from './LearningPath'
import { DEFAULT_FLOW_OPTIONS, FLOW_CHECKPOINT, transactionFrames, type FlowConnection, type FlowOptions } from './transaction-flow'

const STATE: Record<FlowConnection['state'], string> = { idle: '사용 가능', begin: '트랜잭션 시작', holding: 'UPDATE 완료 · 잠금 보유', 'lock-wait': '행 잠금 기다림', ended: '트랜잭션 종료 · 앱이 보유' }
const FIRST_CHOICES = [
  'C3를 빌리면 UPDATE가 바로 끝난다',
  'C3를 빌리고 7번 행의 잠금을 기다린다',
  '연결 수가 늘어도 계속 풀에서 기다린다',
]
const SECOND_CHOICES = [
  '7번 행의 잠금이 풀릴 때까지 기다린다',
  '42번 행의 UPDATE를 진행할 수 있다',
]

function Prediction({ id, title, choices, explanation, onReveal }: { id: string; title: string; choices: string[]; explanation: string; onReveal?: () => void }) {
  const [choice, setChoice] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  return <fieldset className="sp-flow-prediction"><legend>{title}</legend><div>{choices.map((label, index) => <label key={label}><input type="radio" name={id} checked={choice === index} onChange={() => { setChoice(index); setRevealed(false) }} />{label}</label>)}</div><button type="button" className="sp-secondary" disabled={choice === null} onClick={() => { setRevealed(true); onReveal?.() }}>선택과 이유 확인</button>{revealed && <p role="status" className="sp-flow-feedback">{explanation}</p>}</fieldset>
}

export function TransactionLesson({ onBack, onExperiment, experimentDisabled = false }: { onBack: () => void; onExperiment?: () => void; experimentDisabled?: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const optionsBar = useRef<HTMLDivElement>(null)
  const rowPredictionTarget = useRef<HTMLDivElement>(null)
  const focusHeadingNext = useRef(false)
  const focusOptionsNext = useRef(false)
  useEffect(() => { heading.current?.focus() }, [])
  const [options, setOptions] = useState<FlowOptions>(DEFAULT_FLOW_OPTIONS)
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [motionPaused, setMotionPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [compare, setCompare] = useState(false)
  const [hasCompared, setHasCompared] = useState(false)
  const [poolPredictionReviewed, setPoolPredictionReviewed] = useState(false)
  const [rowPredictionReviewed, setRowPredictionReviewed] = useState(false)
  const frames = useMemo(() => transactionFrames(options), [options])
  const frame = frames[position]
  const last = position === frames.length - 1
  const checkpoint = position === FLOW_CHECKPOINT
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { setReducedMotion(query.matches); if (query.matches) setPlaying(false) }
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!playing || reducedMotion || last || checkpoint) return
    const timer = window.setTimeout(() => setPosition((current) => Math.min(current + 1, frames.length - 1)), 3300)
    return () => window.clearTimeout(timer)
  }, [playing, reducedMotion, position, frames.length, last, checkpoint])
  useEffect(() => { if (last || checkpoint) setPlaying(false) }, [last, checkpoint])
  useEffect(() => {
    if (focusHeadingNext.current) { heading.current?.focus(); focusHeadingNext.current = false }
  }, [position])
  useEffect(() => {
    if (compare && focusOptionsNext.current) {
      optionsBar.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus()
      focusOptionsNext.current = false
    }
  }, [compare])
  function step(delta: -1 | 1) {
    const next = Math.max(0, Math.min(frames.length - 1, position + delta))
    focusHeadingNext.current = next !== position && (next === 0 || next === frames.length - 1)
    setPlaying(false); setMotionPaused(false); setPosition(next)
  }
  function toggleComparison() {
    if (!compare) { setHasCompared(true); focusOptionsNext.current = true }
    setCompare(!compare)
  }
  function replayConditions() {
    focusHeadingNext.current = true
    setPlaying(false); setMotionPaused(false); setPosition(0)
  }
  function focusRowPrediction() {
    rowPredictionTarget.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus()
  }
  function changeOptions(next: Partial<FlowOptions>) { setPlaying(false); setMotionPaused(false); setOptions((current) => ({ ...current, ...next })) }
  function keyboard(event: KeyboardEvent<HTMLElement>) { if (event.target instanceof HTMLButtonElement && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); step(event.key === 'ArrowLeft' ? -1 : 1) } }
  const current = position < 2 ? 2 : position < FLOW_CHECKPOINT ? 3 : 4
  const visibleRows = options.rows === 'same' ? [7] : [7, 8, 9]
  return <section className="sp-flow" aria-label="트랜잭션과 락의 학습" onKeyDown={keyboard}>
    <LearningPath current={current} />
    <div className="sp-intro-heading"><h2 ref={heading} tabIndex={-1}>{frame.title}</h2><p>{position === 0 ? '새 사례이므로 요청과 연결 번호도 R1·C1부터 다시 시작합니다.' : position === 1 ? '트랜잭션은 함께 확정할 DB 작업 묶음이며, 같은 연결에서 진행합니다.' : position === 2 ? 'COMMIT은 변경을 확정하는 명령입니다. 지금은 앱이 아직 COMMIT을 보내지 않은 장면입니다.' : position < 6 ? '행 잠금은 다른 트랜잭션의 같은 행 수정을 기다리게 합니다.' : '트랜잭션 종료와 연결 반납을 차례로 살펴보세요.'}</p></div>
    {position >= FLOW_CHECKPOINT && compare && <div id="sp-flow-options" className="sp-flow-options" ref={optionsBar} role="group" aria-label="학습 조건 비교">
      <fieldset><legend>풀의 최대 연결 수</legend>{([2, 3] as const).map((pool) => <label key={pool}><input type="radio" name="sp-flow-pool" checked={options.pool === pool} onChange={() => changeOptions({ pool })} />{pool}개</label>)}</fieldset>
      {rowPredictionReviewed && <><fieldset><legend>각 요청이 수정할 행</legend><label><input type="radio" name="sp-flow-rows" checked={options.rows === 'same'} onChange={() => changeOptions({ rows: 'same' })} />모두 7번 행</label><label><input type="radio" name="sp-flow-rows" checked={options.rows === 'different'} onChange={() => changeOptions({ rows: 'different' })} />서로 다른 7·8·9번 행</label></fieldset><fieldset><legend>R1의 트랜잭션 종료</legend>{(['COMMIT', 'ROLLBACK'] as const).map((ending) => <label key={ending}><input type="radio" name="sp-flow-end" checked={options.ending === ending} onChange={() => changeOptions({ ending })} />{ending === 'COMMIT' ? 'COMMIT · 확정' : 'ROLLBACK · 취소'}</label>)}</fieldset></>}
      <p className="sp-sr-only">현재 장면에 같은 조건을 적용합니다.</p><button type="button" className="sp-text-button" onClick={replayConditions}>이 조건으로 처음부터 보기</button>
    </div>}
    <div className="sp-flow-scene" data-motion-paused={motionPaused} data-transfer={frame.transfer?.kind ?? 'none'}>
      <section className="sp-flow-app" aria-label="요청과 풀 대기"><h3>앱의 요청</h3>{(['R1', 'R2', 'R3'] as const).map((request) => { const connection = frame.connections.find((item) => item.request === request); return <div className="sp-flow-request" data-waiting={frame.poolQueue.includes(request)} key={request}><strong>{request}</strong><span>{connection ? `${connection.id} 사용 중` : frame.poolQueue.includes(request) ? '풀에서 연결 기다림' : position === 0 || (request === 'R2' && position < 3) || (request === 'R3' && position < 5) ? '아직 도착 전' : '반납 완료'}</span></div> })}</section>
      <section className="sp-flow-pool" aria-label="연결 점유와 트랜잭션"><h3>커넥션 풀 <small>최대 {options.pool}개</small></h3>{frame.connections.map((connection) => <div className="sp-flow-connection" data-state={connection.state} data-created={connection.created} key={connection.id}><div><strong>{connection.created ? connection.id : '추가 연결 가능'}</strong><span>{connection.request ? `${connection.request}에 빌려줌` : connection.created ? '풀에서 보관' : '아직 생성 전'}</span></div><p>{connection.created ? STATE[connection.state] : '요청에 따라 연결을 준비합니다'}</p><code>{connection.sql}</code>{connection.transaction === 'open' && <small>트랜잭션 열림{connection.pendingValue !== null ? ` · 미확정 값 ${connection.pendingValue}` : ''}</small>}{frame.transfer?.request === connection.request && frame.transfer.kind !== 'release' && <b key={`${position}-${options.pool}-${options.rows}-${options.ending}`} className="sp-flow-transfer" aria-hidden="true">{frame.transfer.kind === 'end' ? options.ending === 'ROLLBACK' && connection.request === 'R1' ? 'ROLLBACK' : 'COMMIT' : connection.sql === 'BEGIN' ? 'BEGIN' : 'UPDATE'} →</b>}</div>)}</section>
      <section className="sp-flow-db" aria-label="DB의 행 잠금"><h3>DB · counters 표</h3><p className="sp-flow-db-note">행은 자료 한 건입니다. id는 행을 구분하는 번호, value는 저장된 숫자입니다.</p><div className="sp-flow-db-content" key={`${position}-${options.pool}-${options.rows}-${options.ending}`}>{visibleRows.map((row) => { const lock = frame.locks.find((item) => item.row === row); const owner = frame.connections.find((item) => item.request === lock?.owner); const waiters = frame.connections.filter((item) => item.row === row && item.state === 'lock-wait'); return <div className="sp-flow-row" key={row}><strong>id = {row}</strong><p>확정 값 <b>{frame.committed[row]}</b></p><p>{lock ? `${lock.owner} 잠금 보유` : '보유한 잠금 없음'}</p>{owner?.pendingValue != null && <small>{lock!.owner} 미확정 값 {owner.pendingValue}</small>}{waiters.length > 0 && <p className="sp-flow-lock-wait">{waiters.map((item) => `${item.request}(${item.id})`).join(', ')} 잠금 기다림</p>}</div> })}<p className="sp-flow-change">R1의 변경: {{ none: '아직 없음', pending: '미확정', committed: '확정됨', 'rolled-back': '취소됨' }[frame.r1Change]}</p></div></section>
    </div>
    <p className="sp-intro-caption" role="status" aria-live="polite" aria-atomic="true"><span>{position + 1} / {frames.length}</span>{frame.caption}</p>
    <div className="sp-intro-controls"><button type="button" className="sp-secondary" disabled={reducedMotion} onClick={() => { if (last) setPosition(0); else if (checkpoint) setPosition(position + 1); setMotionPaused(playing); setPlaying(!playing) }}>{playing ? '일시정지' : last ? '처음부터 재생' : '재생'}</button><button type="button" className="sp-text-button" onClick={() => { setPlaying(false); setMotionPaused(false); setPosition(0) }}>다시 보기</button><div className="sp-intro-step-controls"><button type="button" className="sp-secondary" disabled={position === 0} onClick={() => step(-1)}>이전 장면</button><button type="button" className="sp-secondary" onClick={last ? focusRowPrediction : () => step(1)}>{last ? '다른 상황 예측하기' : '다음 장면'}</button></div></div>
    {reducedMotion && <p className="sp-intro-help">동작 줄이기 설정이 켜져 있습니다. 이전·다음 장면 버튼으로 살펴보세요.</p>}
    {position >= FLOW_CHECKPOINT && <>
      {checkpoint && !hasCompared && <details className="sp-flow-question" open><summary>새 조건 예측</summary><Prediction id="sp-predict-pool" title="처음 본 조건에서 예측 · R1이 7번 행을 잠그고 R2가 같은 행을 기다립니다. 풀 상한만 2개에서 3개로 늘리면 R3는?" choices={FIRST_CHOICES} onReveal={() => setPoolPredictionReviewed(true)} explanation="R3는 C3를 빌린 뒤 7번 행의 잠금을 기다립니다. R1이 트랜잭션을 끝내면 이 예시에서는 R2의 UPDATE가 이어지며, R3는 R2의 종료를 기다립니다." /></details>}
      {(poolPredictionReviewed || rowPredictionReviewed) && <div className="sp-flow-comparison"><button type="button" className="sp-secondary" aria-expanded={compare} aria-controls="sp-flow-options" onClick={toggleComparison}>조건을 바꿔 비교하기</button></div>}
    </>}
    {last && <><div ref={rowPredictionTarget}><Prediction id="sp-predict-row" title="완료된 장면과 별개의 새 상황입니다. R1은 7번 행을 잠그고 있고, 42번 행에는 다른 잠금이 없습니다. C2를 빌린 R2가 42번 행을 UPDATE하면?" choices={SECOND_CHOICES} onReveal={() => setRowPredictionReviewed(true)} explanation="R2는 42번 행의 UPDATE를 진행할 수 있으며, C2는 앱이 반납할 때까지 사용 중입니다." /></div>{onExperiment && <div className="sp-actions"><button type="button" className="sp-secondary" disabled={experimentDisabled} onClick={onExperiment}>요청 수와 풀 크기 보충 실험 →</button></div>}</>}
    <details className="sp-optional"><summary>예시의 조건과 근거</summary><p>PostgreSQL의 Read Committed에서 키가 아닌 value 열을 수정합니다. 다른 경합·트리거·외래 키 영향·오류·시간 초과는 제외합니다. 이 실행 예시는 R2가 먼저 잠금을 얻는 순서를 택했으며 잠금 대기의 일반적인 선입선출 보장을 뜻하지 않습니다.</p><p>COMMIT은 변경을 확정하고, ROLLBACK은 변경을 취소하며 이 트랜잭션의 잠금을 풉니다. 앱의 연결 반납은 별도 동작입니다. 일반 SELECT는 이 UPDATE의 행 잠금 때문에 보통 같은 방식으로 기다리지 않습니다.</p><p>장면·조건·예측 선택은 화면을 벗어나면 초기화됩니다. 기존 학습 메모는 그대로 보관됩니다.</p><ul><li><a href="https://www.postgresql.org/docs/current/tutorial-transactions.html">PostgreSQL · 트랜잭션</a></li><li><a href="https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS">PostgreSQL · 행 잠금</a></li><li><a href="https://node-postgres.com/features/transactions">node-postgres · 같은 연결의 트랜잭션</a></li></ul></details>
    <button type="button" className="sp-text-button" onClick={onBack}>연결과 풀 다시 보기</button>
  </section>
}
