'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ConnectedLearningFlow } from './ConnectedLearningFlow'
import { ACTIVITIES, WORKSPACE_KEY, validateProposal, type ActivityId, type ExperimentParams, type Proposal, type Session, type Workspace } from '@/lib/study-poc/contract'
import { createSession, emptyWorkspace, simulateQueue, submitAttempt, updateSession, type SessionPatch } from '@/lib/study-poc/model'
import { commitWorkspace, exportWorkspace, mergeWorkspaceImport, parseWorkspaceImport, readWorkspace, type LockManagerLike } from '@/lib/study-poc/storage'

const LABELS: Record<ActivityId, string> = { explain: '풀의 역할 읽기', compare: '차이 비교하기', experiment: '풀 크기 바꾸기', check: '새 조건 설명하기', reflect: '내 설명 정리하기' }
const TITLES: Record<ActivityId, string> = { explain: '커넥션 풀은 연결을 어떻게 관리할까?', compare: '연결을 매번 만들 때와 재사용할 때의 차이', experiment: '연결 수를 바꿔 대기를 확인하세요', check: '서버가 2대에서 4대로 늘면?', reflect: '내 설명과 다음 질문' }
const SOURCE_IDS = ['hikari-sizing', 'hikari-config', 'postgres-connections']
const SOURCES = [
  { id: 'hikari-sizing', label: '풀 크기는 조건에 따라', note: 'HikariCP · 크기 산정의 출발점과 한계', href: 'https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing' },
  { id: 'hikari-config', label: '연결 상한과 대기 시간', note: 'HikariCP · maximumPoolSize / connectionTimeout', href: 'https://github.com/brettwooldridge/HikariCP#configuration-knobs-baby' },
  { id: 'postgres-connections', label: 'DB의 최대 연결 수', note: 'PostgreSQL · 연결 한도와 자원 할당', href: 'https://www.postgresql.org/docs/current/runtime-config-connection.html' },
]
const DEFAULT_GOAL = '커넥션 풀을 늘리면 왜 항상 빨라지지는 않을까?'
const newId = () => typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `poc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
const now = () => new Date().toISOString()

function ModelConditions({ requests, dbCapacity }: { requests: number; dbCapacity: number }) {
  return <section className="sp-model-conditions" aria-label="실험 조건">
    <p>행 잠금 대기를 제외하고 DB 동시 처리 한도를 정한 보충 실험입니다.</p>
    <p>DB 조회 요청 <strong>{requests}개가 동시에 도착</strong>해 DB가 <strong>최대 {dbCapacity}개씩</strong> 처리하며 요청당 <strong className="sp-unit">3초</strong>가 걸린다고 가정합니다.</p>
  </section>
}

function ProcessingSteps({ pool, requests, dbCapacity }: { pool: number; requests: number; dbCapacity: number }) {
  const parallel = Math.min(pool, dbCapacity, requests)
  const batches = Math.ceil(requests / parallel)
  const finalBatch = requests % parallel
  return <section className="sp-calculation" aria-label="완료 시간 계산 과정" aria-live="polite">
    <p>{requests < Math.min(pool, dbCapacity) ? <>요청 {requests}개를 한 번에 처리합니다.</> : pool <= dbCapacity ? <>한 번에 {parallel}개씩 처리합니다.</> : <>DB 처리 한계로 한 번에 {parallel}개씩 처리합니다.</>}</p>
    <p>{requests}개를 {parallel}개씩, 총 <strong>{batches}묶음</strong>{finalBatch !== 0 && <> 마지막 묶음은 {finalBatch}개만 처리합니다.</>}</p>
    <p className="sp-formula">{batches}묶음 × 3초 = <strong>{batches * 3}초</strong></p>
  </section>
}

function QueuePlayground({ params, onPoolChange, prefix, poolReadOnly = false }: {
  params: ExperimentParams
  onPoolChange: (pool: number) => void
  prefix: string
  poolReadOnly?: boolean
}) {
  const result = useMemo(() => simulateQueue(params), [params.pool, params.requests, params.dbCapacity])
  const key = `${prefix}:${params.pool}:${params.requests}:${params.dbCapacity}`
  const [clock, setClock] = useState({ key, value: 0 })
  useEffect(() => { setClock({ key, value: 0 }) }, [key])
  const elapsed = clock.key === key ? Math.max(0, Math.min(result.ticks, Math.trunc(clock.value))) : 0
  const row = result.rows[elapsed]
  const zones = [
    { key: 'waitingPool', label: '연결 빌리기 전 대기' },
    { key: 'waitingDb', label: '연결을 빌린 뒤 DB 대기' },
    { key: 'active', label: 'DB에서 처리 중' },
    { key: 'completed', label: '지금까지 완료' },
  ] as const
  return <section className="sp-playground" aria-label="요청 상태 직접 조작">
    <div className="sp-workbench">
      <div className="sp-workbench-controls">
    <div className="sp-range-control"><label htmlFor={`${prefix}-pool`}>동시에 빌려줄 연결 수 <output htmlFor={`${prefix}-pool`}>최대 {params.pool}개</output></label><input id={`${prefix}-pool`} type="range" min={1} max={12} step={1} value={params.pool} aria-valuetext={`최대 ${params.pool}개`} disabled={poolReadOnly} onChange={(event) => onPoolChange(Number(event.target.value))} /></div>
    <div className="sp-range-control"><label htmlFor={`${prefix}-time`}>예시 시간 <output htmlFor={`${prefix}-time`}>{elapsed}초</output></label><input id={`${prefix}-time`} type="range" min={0} max={result.ticks} step={1} value={elapsed} aria-valuetext={`예시의 ${elapsed}초 시점, 모든 요청 완료 ${result.ticks}초`} onChange={(event) => { const value = Number(event.target.value); setClock({ key, value: Number.isFinite(value) ? Math.max(0, Math.min(result.ticks, Math.trunc(value))) : 0 }) }} /><div className="sp-time-ends"><span>도착 0초</span><span>모두 완료 {result.ticks}초</span></div></div>
      </div>
      <div className="sp-workbench-observation">
    <div className="sp-request-zones">{zones.map((zone) => <section className={`sp-request-zone sp-zone-${zone.key}`} aria-label={zone.label} key={zone.key}><h2>{zone.label}</h2><p className="sp-zone-count">{row[zone.key]}<span>개</span></p><div className="sp-request-dots" aria-hidden="true">{Array.from({ length: row[zone.key] }, (_, index) => <i key={index} />)}{row[zone.key] === 0 && <span>—</span>}</div></section>)}</div>
      </div>
    </div>
    <ProcessingSteps {...params} />
    <p role="status" className="sp-sr-only">예시의 {elapsed}초 시점. 연결 빌리기 전 대기 {row.waitingPool}개, 연결을 빌린 뒤 DB 대기 {row.waitingDb}개, DB에서 처리 중 {row.active}개, 지금까지 완료 {row.completed}개.</p>
  </section>
}

export function StudyPoc({ publicLesson = false }: { publicLesson?: boolean }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const workspaceRef = useRef<Workspace | null>(null)
  const rawRef = useRef<string | null>(null)
  const writeAllowed = useRef(false)
  const queue = useRef(Promise.resolve())
  const alive = useRef(true)
  const [storageMessage, setStorageMessage] = useState('')
  const [unreadableRaw, setUnreadableRaw] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [saveStatus, setSaveStatus] = useState('저장된 학습을 불러오는 중입니다.')
  const [goal, setGoal] = useState(DEFAULT_GOAL)
  const [showStart, setShowStart] = useState(publicLesson)
  const [showIntro, setShowIntro] = useState(false)
  const [backup, setBackup] = useState('')
  const [includeAnswers, setIncludeAnswers] = useState(false)
  const [importPreview, setImportPreview] = useState<Workspace | null>(null)
  const [backupMessage, setBackupMessage] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [proposalMessage, setProposalMessage] = useState('')
  const [mode, setMode] = useState<'rules' | 'ai'>('rules')
  const request = useRef<{ controller: AbortController; requestId: string; sessionId: string; revision: number } | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const focusNext = useRef(false)
  const goalInput = useRef<HTMLInputElement>(null)
  const locks = () => typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManagerLike }).locks ?? null : null

  useEffect(() => {
    alive.current = true
    try {
      const result = readWorkspace(window.localStorage)
      rawRef.current = result.raw
      const state = result.state ?? emptyWorkspace()
      workspaceRef.current = state
      setWorkspace(state)
      writeAllowed.current = result.status === 'ready' && Boolean(locks())
      if (result.status !== 'ready') { setStorageMessage('저장된 학습을 읽을 수 없습니다. 기존 기록은 변경하지 않았습니다.'); setUnreadableRaw(result.raw) }
      else if (!locks()) setStorageMessage('이 브라우저에서는 저장할 수 없습니다. 기록을 읽거나 백업할 수 있습니다.')
      setSaveStatus(result.state?.currentSessionId ? '저장한 지점에서 이어갈 수 있습니다.' : '아직 저장된 학습이 없습니다.')
    } catch {
      workspaceRef.current = emptyWorkspace()
      setWorkspace(emptyWorkspace())
      writeAllowed.current = false
      setStorageMessage('학습 기록에 접근할 수 없습니다. 설명과 출처는 계속 읽을 수 있습니다.')
    }
    const changed = (event: StorageEvent) => {
      if ((event.key === WORKSPACE_KEY || event.key === null) && event.newValue !== rawRef.current) {
        writeAllowed.current = false
        setStorageMessage('다른 탭에서 기록이 바뀌어 저장을 멈췄습니다. 입력을 복사한 뒤 새로고침해 주세요.')
      }
    }
    window.addEventListener('storage', changed)
    return () => { alive.current = false; window.removeEventListener('storage', changed); request.current?.controller.abort() }
  }, [])

  const session = workspace?.currentSessionId ? workspace.sessionsById[workspace.currentSessionId] : undefined
  const activity = session?.currentActivity ?? 'explain'
  const order = session?.activityOrder ?? [...ACTIVITIES]
  const position = order.indexOf(activity)
  const simulation = useMemo(() => session ? simulateQueue(session.experiment) : null, [session?.experiment])
  useEffect(() => {
    if (focusNext.current) { heading.current?.focus(); focusNext.current = false }
  }, [session?.id, activity, showStart, showIntro])

  function persist(next: Workspace) {
    workspaceRef.current = next
    setWorkspace(next)
    if (!writeAllowed.current) { setSaveStatus('저장되지 않았습니다. 현재 입력을 복사해 보관해 주세요.'); return }
    setSaveStatus('저장 중…')
    queue.current = queue.current.then(async () => {
      if (!writeAllowed.current) return
      const result = await commitWorkspace(window.localStorage, locks(), rawRef.current, next)
      if (result.ok) { rawRef.current = result.raw; if (alive.current) setSaveStatus('이 브라우저에 저장했습니다.') }
      else {
        writeAllowed.current = false
        if (alive.current) { setStorageMessage('저장하지 못했습니다. 입력을 복사해 보관해 주세요.'); setSaveStatus('저장 실패') }
      }
    }).catch(() => {
      writeAllowed.current = false
      if (alive.current) { setStorageMessage('저장하지 못했습니다. 화면의 입력을 따로 복사해 보관해 주세요.'); setSaveStatus('저장되지 않았습니다.') }
    })
  }
  function change(update: (current: Session) => Session) {
    const state = workspaceRef.current
    if (!state?.currentSessionId) return
    try {
      const current = state.sessionsById[state.currentSessionId]
      const next = update(current)
      persist({ ...state, revision: state.revision + 1, sessionsById: { ...state.sessionsById, [next.id]: next } })
      if (request.current) cancelProposal('학습 내용이 바뀌어 이전 추천 요청을 취소했습니다.')
      if (proposal) { setProposal(null); setProposalMessage('학습 내용이 바뀌어 추천을 지웠습니다.') }
    } catch { setSaveStatus('변경을 반영하지 못했습니다. 이전 기록은 유지했습니다.') }
  }
  const patch = (value: SessionPatch) => change((current) => updateSession(current, value, now()))
  function goTo(next: ActivityId) { focusNext.current = true; patch({ activity: next }) }
  function start() {
    if (!workspaceRef.current || !writeAllowed.current) return
    try {
      const current = workspaceRef.current
      if (Object.keys(current.sessionsById).length >= 20) { setBackupMessage('학습 20개를 보관 중이라 새로 추가할 수 없습니다. 기존 학습을 이어가거나 백업해 주세요.'); return }
      const created = updateSession(createSession(goal.trim() || DEFAULT_GOAL, newId(), now()), { activity: 'experiment', order: ['explain', 'experiment', 'compare', 'check', 'reflect'], experiment: { pool: 2, requests: 12, dbCapacity: 3 } }, now())
      focusNext.current = true
      persist({ ...current, revision: current.revision + 1, currentSessionId: created.id, sessionsById: { ...current.sessionsById, [created.id]: created } })
      request.current?.controller.abort(); request.current = null; setRequesting(false)
      setShowStart(false); setShowIntro(false); setProposal(null); setMode('rules')
    } catch { setSaveStatus('새 학습을 시작하지 못했습니다. 이전 기록은 유지했습니다.') }
  }
  function resume(id: string) {
    const current = workspaceRef.current
    if (!current?.sessionsById[id]) return
    request.current?.controller.abort(); request.current = null; setRequesting(false); setProposal(null)
    focusNext.current = true
    persist({ ...current, revision: current.revision + 1, currentSessionId: id })
    setShowStart(false); setShowIntro(false)
  }
  function cancelProposal(message = '추천을 취소했습니다.') {
    request.current?.controller.abort(); request.current = null; setRequesting(false); setProposal(null); setProposalMessage(message)
  }
  async function propose() {
    if (publicLesson) return
    const current = workspaceRef.current
    const selected = current?.currentSessionId ? current.sessionsById[current.currentSessionId] : undefined
    if (!selected || request.current) return
    const active = { controller: new AbortController(), requestId: newId(), sessionId: selected.id, revision: selected.revision }
    request.current = active; setRequesting(true); setProposal(null); setProposalMessage('추천할 활동을 고르는 중입니다.')
    try {
      const response = await fetch('/api/study-poc/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: active.controller.signal, body: JSON.stringify({ requestId: active.requestId, sessionId: selected.id, revision: selected.revision, goal: selected.goal.slice(0, 200), currentActivity: selected.currentActivity, allowedActivityIds: [...ACTIVITIES] }) })
      if (!response.ok) throw new Error('proposal_failed')
      const raw: unknown = await response.json()
      if (!alive.current || active.controller.signal.aborted || request.current !== active) return
      const latest = workspaceRef.current
      const latestSession = latest?.currentSessionId ? latest.sessionsById[latest.currentSessionId] : undefined
      if (latestSession?.id !== active.sessionId || latestSession.revision !== active.revision) { cancelProposal('학습 내용이 바뀌어 이전 추천은 적용하지 않았습니다.'); return }
      const valid = validateProposal(raw, { ...active, allowedActivityIds: ACTIVITIES, allowedSourceIds: SOURCE_IDS })
      if (!valid) throw new Error('invalid_proposal')
      setProposal(valid)
      setProposalMessage(valid.mode === 'ai' ? '' : '')
    } catch {
      if (alive.current && !active.controller.signal.aborted && request.current === active) setProposalMessage('추천을 불러오지 못했습니다. 현재 활동을 계속할 수 있습니다.')
    } finally { if (request.current === active) { request.current = null; if (alive.current) setRequesting(false) } }
  }
  function acceptProposal() {
    if (!proposal || !session || session.id !== proposal.sessionId || session.revision !== proposal.revision) { setProposal(null); return }
    const accepted = proposal
    setProposal(null); setMode(accepted.mode)
    const reordered = [...accepted.activityIds, ...ACTIVITIES.filter((id) => !accepted.activityIds.includes(id))]
    focusNext.current = true
    patch({ activity: accepted.activityIds[0], order: reordered })
    setProposalMessage(accepted.mode === 'ai' ? '학습 순서를 바꿨습니다.' : '학습 순서를 바꿨습니다.')
  }
  function exportJson() {
    if (!workspaceRef.current) return
    if (unreadableRaw !== null) { setShowRaw(true); setBackupMessage('저장된 학습을 읽을 수 없습니다. 복구용 저장 내용을 따로 복사해 보관해 주세요.'); return }
    try { setBackup(exportWorkspace(workspaceRef.current, includeAnswers)); setImportPreview(null); setBackupMessage(includeAnswers ? '메모·답변을 포함했습니다. 공유 전에 확인해 주세요.' : '메모·답변을 제외한 백업입니다.') }
    catch { setBackupMessage('백업을 만들지 못했습니다. 기존 기록은 유지했습니다. 현재 입력을 따로 복사해 보관해 주세요.') }
  }
  function previewImport() {
    try { setImportPreview(parseWorkspaceImport(backup)); setBackupMessage('가져올 학습을 확인해 주세요.') }
    catch { setImportPreview(null); setBackupMessage('백업 내용을 읽을 수 없습니다. 기존 기록은 바꾸지 않았습니다.') }
  }
  function acceptImport() {
    if (!importPreview || !workspaceRef.current || !writeAllowed.current) return
    try { const merged = mergeWorkspaceImport(workspaceRef.current, importPreview); persist(merged); setImportPreview(null); setBackupMessage('학습을 합쳤습니다. 저장 상태를 확인해 주세요.') }
    catch { setBackupMessage('기록을 합치지 못했습니다. 기존 기록과 백업 내용을 비교해 주세요.') }
  }

  const draft = session?.answers[activity]?.text ?? ''
  const sessions = workspace ? Object.values(workspace.sessionsById).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : []
  const editor = session ? <div className="sp-editor"><label className="sp-label" htmlFor={`sp-answer-${activity}`}>{activity === 'check' ? '내 선택과 그 이유' : activity === 'reflect' ? '내 설명과 다음에 확인할 질문' : '메모'}</label><textarea id={`sp-answer-${activity}`} className="sp-textarea" rows={activity === 'check' || activity === 'reflect' ? 3 : 2} maxLength={6000} value={draft} readOnly={!writeAllowed.current} onChange={(event) => patch({ answer: { activity, text: event.target.value } })} aria-describedby="sp-save-status" placeholder="내 말로 적어 보세요." /></div> : null
  const assumptions = <><p>준비된 연결 하나로 요청 하나를 처리하고 완료 후 반납합니다. DB가 바쁘면 연결을 가진 채 기다립니다. 요청은 0초에 함께 도착하며 먼저 온 순서대로 처리합니다. 계산에는 대기 시간도 포함합니다.</p><p>연결 생성·네트워크·SQL 비용·추가 경합 지연은 제외합니다. DB 처리 한도는 직접 정한 값이며 CPU 코어 수로 계산하지 않습니다. 실제 DB에서 측정한 결과는 아닙니다.</p></>
  const savedAttempts = session?.attempts.filter((item) => item.activity === 'check') ?? []
  const nextActivity = position < order.length - 1 ? order[position + 1] : null
  const notes = activity === 'check' || activity === 'reflect' ? editor : <details className="sp-optional"><summary>메모 남기기</summary>{editor}</details>

  return <div className="study-poc">
    <a className="sp-skip" href="#sp-activity">학습 내용으로 건너뛰기</a>
    <header className="sp-top"><a href="/" className="sp-brand">CS 길라잡이</a><nav className="sp-public-nav" aria-label="학습 메뉴">{publicLesson ? <><a href="/#desk-shelf-title">공부 자료</a><a href="/learn/library">내 서재</a></> : <span className="sp-mode">커넥션 풀</span>}</nav></header>
    <div className="sp-shell">
      {session && !showStart && !showIntro && <div className="sp-session-header"><nav aria-label="현재 학습과 단계"><ol className="sp-steps">{order.map((id, index) => <li key={id}><button type="button" className="sp-step" aria-current={activity === id ? 'step' : undefined} onClick={() => goTo(id)}><span>{index + 1}</span>{LABELS[id]}</button></li>)}</ol></nav><details><summary>현재 질문</summary><p>{session.goal}</p></details></div>}
      {session && !showStart && !showIntro && activity !== 'explain' && <button type="button" className="sp-text-button sp-intro-entry" onClick={() => { setShowIntro(true); focusNext.current = true }}>DB 연결 처음 보기</button>}
      <main className="sp-main" id="sp-activity" data-activity={session && !showStart && !showIntro ? activity : 'start'}>
        {storageMessage && <p className="sp-warning" role="alert">{storageMessage}</p>}
        {!workspace ? <p role="status">저장된 학습을 불러오는 중입니다.</p> : showIntro ? <>
          <h1 className="sp-title" ref={heading} tabIndex={-1}>DB 연결부터 살펴보기</h1>
          <ConnectedLearningFlow key={`revisit-${session?.id}`} />
          <button type="button" className="sp-secondary" onClick={() => { setShowIntro(false); focusNext.current = true }}>하던 학습으로 돌아가기</button>
        </> : !session || showStart ? <>
          <h1 className="sp-title" ref={heading} tabIndex={-1}>DB 연결부터 살펴보기</h1>
          <ConnectedLearningFlow key="new-intro" onExperiment={start} experimentDisabled={!writeAllowed.current} />
          <details className="sp-optional" open={showStart && Boolean(session)}><summary>질문 바꾸기</summary><label className="sp-label" htmlFor="sp-goal">이번에 확인할 질문</label><input ref={goalInput} id="sp-goal" className="sp-input" value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={200} /></details>
          {session && <button type="button" className="sp-text-button" onClick={() => setShowStart(false)}>하던 학습으로 돌아가기</button>}
        </> : <>
          <h1 className="sp-title" ref={heading} tabIndex={-1}>{TITLES[activity]}</h1>
          {activity === 'explain' && <ConnectedLearningFlow key={`explain-${session.id}`} onExperiment={() => goTo('experiment')} />}
          {activity === 'compare' && <><div className="sp-table-wrap"><table className="sp-table"><caption>연결 방식 비교</caption><thead><tr><th scope="col">비교할 것</th><th scope="col">요청마다 새 연결</th><th scope="col">풀에서 재사용</th></tr></thead><tbody><tr><th scope="row">연결 준비</th><td>요청마다 반복할 수 있음</td><td>유지 중인 연결을 다시 사용</td></tr><tr><th scope="row">동시 작업 수</th><td>별도 제한이 필요함</td><td>최대 연결 수로 제한함</td></tr><tr><th scope="row">추가로 확인할 것</th><td>생성 비용·전체 연결 수</td><td>연결 대기·느린 질의·반납 누락</td></tr></tbody></table></div><p className="sp-answer-line">질의 실행 시간과 대기는 따로 확인해야 합니다.</p></>}
          {activity === 'experiment' && session && simulation && <>
            <ModelConditions requests={session.experiment.requests} dbCapacity={session.experiment.dbCapacity} />
            <QueuePlayground key={session.id} params={session.experiment} onPoolChange={(pool) => patch({ experiment: { ...session.experiment, pool } })} prefix={`session-${session.id}`} poolReadOnly={!writeAllowed.current} />

          </>}
          {activity === 'check' && <><p className="sp-lead">각 서버의 풀 크기는 그대로 둬도 될까요?</p><dl className="sp-scenario"><div><dt>앱 서버</dt><dd>2대 → 4대</dd></div><div><dt>서버당 최대 연결 수</dt><dd>4개</dd></div><div><dt>DB에 허용한 연결 수</dt><dd>18개</dd></div><div><dt>다른 작업에 남겨둘 연결</dt><dd>2개</dd></div></dl><p className="sp-meta">모든 서버의 연결 수와 확인할 조건을 적어 보세요.</p>{notes}</>}
          {activity === 'reflect' && <><details className="sp-optional"><summary>활동별 메모 보기</summary><dl>{(['explain', 'compare', 'experiment', 'check'] as ActivityId[]).map((id) => <div className="sp-summary-line" key={id}><dt>{LABELS[id]}</dt><dd>{session.answers[id]?.text || '남긴 설명이 없습니다.'}</dd></div>)}</dl></details>{notes}</>}

          <footer className="sp-activity-footer"><button type="button" className="sp-text-button" disabled={position <= 0} onClick={() => goTo(order[position - 1])}>이전</button>
            {activity === 'check' ? <><button type="button" className="sp-text-button" onClick={() => goTo('reflect')}>설명 없이 정리로</button><button type="button" className="sp-primary" disabled={!draft.trim() || !writeAllowed.current} onClick={() => { focusNext.current = true; change((current) => updateSession(submitAttempt(current, 'check', newId(), now()), { activity: nextActivity ?? 'reflect' }, now())) }}>설명 저장하고 {nextActivity ? LABELS[nextActivity] : '정리하기'} →</button></> : activity === 'reflect' ? <button type="button" className="sp-primary" onClick={() => { void queue.current.then(() => { if (alive.current) setSaveStatus(writeAllowed.current ? '저장했습니다. 나중에 이어갈 수 있습니다.' : '저장되지 않았습니다. 화면의 입력을 따로 복사해 주세요.') }); heading.current?.focus() }}>여기까지 저장하고 멈추기</button> : nextActivity && <button type="button" className="sp-primary" onClick={() => goTo(nextActivity)}>다음: {LABELS[nextActivity]} →</button>}
          </footer>
          <p id="sp-save-status" role="status" className="sp-status">{saveStatus}</p>
          <div className="sp-activity-extras">
          {activity !== 'check' && activity !== 'reflect' && notes}
          {activity === 'experiment' && session && simulation && <>
<details className="sp-optional"><summary>요청 수·DB 조건 직접 바꾸기</summary><div className="sp-controls">{([{ key: 'requests', label: '동시에 온 요청', max: 36 }, { key: 'dbCapacity', label: 'DB가 동시에 처리할 요청 수', max: 12 }] as const).map(({ key, label, max }) => <div key={key}><label htmlFor={'sp-' + key}>{label}: <output htmlFor={'sp-' + key}>{session.experiment[key]}</output></label><input type="range" id={'sp-' + key} min={1} max={max} value={session.experiment[key]} disabled={!writeAllowed.current} onChange={(event) => patch({ experiment: { ...session.experiment, [key]: Number(event.target.value) } })} /></div>)}</div></details>
            <details className="sp-optional"><summary>실험의 가정과 전체 수치</summary>{assumptions}<div className="sp-table-wrap"><table className="sp-table"><caption>시간별 요청 상태</caption><thead><tr><th scope="col">예시 시간(초)</th><th scope="col">처리 중</th><th scope="col">풀 대기</th><th scope="col">DB 대기</th><th scope="col">완료</th></tr></thead><tbody>{simulation.rows.map((row) => <tr key={row.tick}><td>{row.tick}</td><td>{row.active}</td><td>{row.waitingPool}</td><td>{row.waitingDb}</td><td>{row.completed}</td></tr>)}</tbody></table></div></details>
          </>}
          {activity === 'check' && <><details className="sp-optional"><summary>내 설명과 판단 근거 비교하기</summary><p>모든 서버의 최대 연결 수는 2×4=8개에서 4×4=16개로 늘어납니다. DB에 허용한 연결 수에서 다른 작업에 남겨둘 연결을 빼면 18−2=16개입니다. 이 한도를 지키더라도 실제 처리 성능은 따로 확인해야 합니다.</p><ul><li>연결 재사용과 동시 작업 제한을 구분했나요?</li><li>모든 서버의 연결 수와 DB에 허용한 연결 수를 비교했나요?</li><li>풀 대기와 DB 실행·대기를 구분했나요?</li><li>질의 시간·연결 보유 시간·다른 작업도 확인했나요?</li></ul></details>{savedAttempts.length > 0 && <details className="sp-optional"><summary>이전에 남긴 설명 확인</summary><p className="sp-meta">저장한 내용 {savedAttempts.filter((item) => item.text !== undefined).length}개 · 내용 없는 시도 기록 {savedAttempts.filter((item) => item.text === undefined).length}개</p><ol>{savedAttempts.map((attempt) => <li key={attempt.id} className="sp-past-answer">{attempt.text ?? '작성한 내용 없이 시도 기록만 남아 있습니다.'}</li>)}</ol></details>}</>}
          </div>
        </>}
      </main>
      <section className="sp-support" aria-label="학습 보조 기능">
        <details><summary>기록·새 질문</summary><button type="button" className="sp-text-button" onClick={() => { setShowStart(true); setShowIntro(false); focusNext.current = true }}>새 질문으로 시작</button><ul className="sp-sessions">{sessions.map((item) => <li key={item.id}><button type="button" onClick={() => resume(item.id)}>{item.goal}</button></li>)}</ul>{sessions.length === 0 && <p className="sp-meta">아직 저장한 학습이 없습니다.</p>}</details>
        <details><summary>관련 질문·출처</summary><ul className="sp-sources">{SOURCES.map((source) => <li key={source.id}><a href={source.href}>{source.label}</a><small>{source.note}</small></li>)}</ul><ul className="sp-sources">{['DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?', '커넥션 풀을 사용하는 이유는 무엇인가?', '커넥션 풀 크기를 CPU 코어 수로 잡는 이유는?'].map((question) => <li key={question}><a href={'/questions?q=' + encodeURIComponent(question)}>{question}</a></li>)}</ul><a href="/map?view=connections">기존에 읽은 지식 정리</a><span> · </span><a href="/questions">CS 질문 목록</a></details>
        {!publicLesson && session && !showStart && <details className="sp-compose"><summary>학습 순서 추천</summary><p className="sp-meta">현재 질문과 활동 정보를 전송합니다. 작성한 답변은 전송하지 않습니다.</p><div className="sp-actions"><button type="button" className="sp-secondary" disabled={requesting} onClick={() => void propose()}>학습 순서 추천받기</button>{requesting && <button type="button" className="sp-text-button" onClick={() => cancelProposal()}>추천 취소</button>}</div><p role="status" className="sp-status">{proposalMessage}</p>{proposal && <div className="sp-proposal"><p className="sp-meta">{proposal.mode === 'ai' ? 'AI 추천' : '기본 추천'}</p><p>{proposal.reason}</p><p>{proposal.activityIds.map((id) => LABELS[id]).join(' → ')}</p><button type="button" className="sp-secondary" onClick={acceptProposal}>이 순서로 공부하기</button></div>}</details>}
        <details className="sp-backup"><summary>학습 기록 백업·복원</summary>{unreadableRaw !== null && <div className="sp-proposal"><button type="button" className="sp-text-button" onClick={() => setShowRaw(true)}>복구용 저장 내용 보기</button>{showRaw && <><label className="sp-label" htmlFor="sp-raw-rescue">복구용 저장 내용 · 읽을 수 없는 기록</label><textarea id="sp-raw-rescue" className="sp-textarea" rows={7} readOnly value={unreadableRaw} /><p className="sp-meta">복사해 보관해 주세요.</p></>}</div>}<p className="sp-meta">저장한 학습의 질문·보충 실험 조건·활동 위치·순서·제출 이력을 백업합니다. 연결·트랜잭션 장면과 예측 선택은 제외합니다. 메모·답변은 선택한 경우 포함됩니다. 기존 CS 답안·서재·다른 분야의 기록은 제외합니다.</p><label className="sp-meta"><input type="checkbox" checked={includeAnswers} onChange={(event) => setIncludeAnswers(event.target.checked)} /> 메모·답변 포함</label><div className="sp-actions"><button type="button" className="sp-secondary" disabled={!workspace} onClick={exportJson}>학습 기록 백업 만들기</button></div><label className="sp-label" htmlFor="sp-backup-json">백업 내용(JSON)</label><textarea id="sp-backup-json" className="sp-textarea" rows={5} value={backup} onChange={(event) => { setBackup(event.target.value); setImportPreview(null) }} maxLength={1_148_576} /><button type="button" className="sp-text-button" disabled={!backup.trim()} onClick={previewImport}>백업 내용 확인하기</button>{importPreview && <div className="sp-proposal"><p className="sp-meta">가져올 학습 {Object.keys(importPreview.sessionsById).length}개</p><ul>{Object.values(importPreview.sessionsById).map((item) => <li key={item.id}>{item.goal}</li>)}</ul><button type="button" className="sp-secondary" disabled={!writeAllowed.current} onClick={acceptImport}>현재 기록에 합치기</button></div>}<p role="status" className="sp-status">{backupMessage}</p></details>
      </section>
    </div>
  </div>
}
