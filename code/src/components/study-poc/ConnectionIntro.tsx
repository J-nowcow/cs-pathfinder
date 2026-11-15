'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { LearningPath } from './LearningPath'
import { advanceIntro, INTRO_CHAPTERS, INTRO_SAMPLE, INTRO_SELECT, type IntroPosition } from './connection-intro'

const REQUEST_STATE = { new: '조회 준비', waiting: '연결 기다림', using: 'C1 사용 중', done: '완료' }
const CONNECTION_STATE = { absent: '아직 연결 없음', opening: '연결 중', idle: '사용 가능 · idle', busy: '사용 중 · busy', held: '사용 중 · busy' }

export function ConnectionIntro({ onExperiment, experimentDisabled = false, connected = false, onContinue }: {
  connected?: boolean
  onContinue?: () => void
  onExperiment?: () => void
  experimentDisabled?: boolean
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const focusHeadingNext = useRef(false)
  const [position, setPosition] = useState<IntroPosition>({ chapter: 0, frame: 0 })
  const [playing, setPlaying] = useState(false)
  const [motionPaused, setMotionPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const chapter = INTRO_CHAPTERS[position.chapter]
  const frame = chapter.frames[position.frame]
  const first = position.chapter === 0 && position.frame === 0
  const last = position.chapter === INTRO_CHAPTERS.length - 1 && position.frame === chapter.frames.length - 1
  const chapterEnd = position.frame === chapter.frames.length - 1

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => { setReducedMotion(query.matches); if (query.matches) setPlaying(false) }
    update(); query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!playing || reducedMotion || chapterEnd) return
    const timer = window.setTimeout(() => setPosition((current) => advanceIntro(current, 1)), 3000)
    return () => window.clearTimeout(timer)
  }, [playing, reducedMotion, position, chapterEnd])
  useEffect(() => { if (chapterEnd) setPlaying(false) }, [chapterEnd])

  useEffect(() => {
    if (focusHeadingNext.current) { heading.current?.focus(); focusHeadingNext.current = false }
  }, [position])
  function step(direction: -1 | 1) {
    const next = advanceIntro(position, direction)
    const nextFirst = next.chapter === 0 && next.frame === 0
    const nextLast = next.chapter === INTRO_CHAPTERS.length - 1 && next.frame === INTRO_CHAPTERS[next.chapter].frames.length - 1
    focusHeadingNext.current = next !== position && (nextFirst || nextLast)
    setPlaying(false); setMotionPaused(false); setPosition(next)
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (!(event.target instanceof HTMLButtonElement) || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return
    event.preventDefault(); step(event.key === 'ArrowRight' ? 1 : -1)
  }
  function replay() { setPlaying(false); setMotionPaused(false); setPosition({ chapter: position.chapter, frame: 0 }) }

  return <section className="sp-intro" aria-label="DB 연결과 풀의 동작" onKeyDown={keyboard}>
    {connected ? <LearningPath current={position.chapter === 0 ? 0 : 1} /> : <ol className="sp-intro-chapters" aria-label="살펴볼 순서">{INTRO_CHAPTERS.map((item, index) => <li key={item.title} aria-current={position.chapter === index ? 'step' : undefined}><span>{index + 1}</span>{item.title}</li>)}<li><span>4</span>풀 크기 실험</li></ol>}
    <div className="sp-intro-heading"><h2 ref={heading} tabIndex={-1}>{chapter.title}</h2><p>{chapter.note}</p></div>
    <div className="sp-intro-scene" data-connection={frame.connection} data-playing={playing && !reducedMotion} data-motion-paused={motionPaused}>
      <section className="sp-intro-app" aria-label="앱의 요청"><h3>앱</h3><p className="sp-intro-sublabel">DB 조회 요청</p><ul className="sp-intro-requests">{frame.requests.map((request) => <li key={request.id} data-state={request.state}><strong>{request.id}</strong><span>{REQUEST_STATE[request.state]}</span></li>)}</ul>{frame.result && <p className="sp-intro-result-received">{frame.result} 조회 결과 · value = {INTRO_SAMPLE.value}</p>}</section>
      <section className="sp-intro-pool" aria-label="풀의 DB 연결"><h3>커넥션 풀</h3><p className="sp-intro-sublabel">{position.chapter === 2 ? '최대 연결 1개' : '연결을 보관하고 빌려주는 앱의 구성 요소'}</p><div className="sp-intro-connection"><strong>{frame.connection === 'absent' ? '—' : 'C1'}</strong><span>{CONNECTION_STATE[frame.connection]}</span><small>{frame.borrower ? `${frame.borrower}에 빌려줌` : frame.connection === 'idle' ? '풀에서 보관 중' : '\u00a0'}</small></div></section>
      <div className="sp-intro-link" aria-hidden="true"><span>DB 연결 C1</span><i />{frame.sql && <b key={`${position.chapter}-${frame.sql}`} className="sp-intro-transfer">{frame.sql} SQL →</b>}</div>
      <section className="sp-intro-db" aria-label="DB의 SQL 실행"><h3>DB · 데이터 저장소</h3><p className="sp-intro-sublabel">SQL · DB에 보내는 명령</p><div className="sp-intro-sql" data-active={Boolean(frame.sql)}>{frame.sql ? <span key={`${position.chapter}-${frame.sql}`}><strong>{frame.sql}의 SQL</strong><code>{INTRO_SELECT}</code><small>실행 중</small></span> : <span className="sp-intro-no-sql">실행 중인 SQL 없음</span>}</div><p className="sp-intro-data">{INTRO_SAMPLE.table} 표의 자료 한 건(행)<br />id(구분 번호) = {INTRO_SAMPLE.id}<br />value(저장 숫자) = {INTRO_SAMPLE.value}</p></section>
      {frame.result && <div className="sp-intro-return-path" aria-hidden="true"><b key={`${position.chapter}-${frame.result}`} className="sp-intro-transfer">← {frame.result} 결과 {INTRO_SAMPLE.value}</b></div>}
    </div>
    <p className="sp-intro-caption" role="status" aria-live="polite" aria-atomic="true"><span>{position.frame + 1} / {chapter.frames.length}</span>{frame.caption}</p>
    <div className="sp-intro-controls"><button type="button" className="sp-secondary" disabled={reducedMotion} onClick={() => { if (chapterEnd) setPosition({ ...position, frame: 0 }); setMotionPaused(playing); setPlaying(!playing) }}>{playing ? '일시정지' : chapterEnd ? '이 장면 재생' : '재생'}</button><button type="button" className="sp-text-button" onClick={replay}>다시 보기</button><div className="sp-intro-step-controls"><button type="button" className="sp-secondary" disabled={first} onClick={() => step(-1)}>이전 장면</button><button type="button" className="sp-secondary" disabled={last} onClick={() => step(1)}>{chapterEnd && !last ? '다음 주제' : '다음 장면'}</button></div></div>
    <p className="sp-sr-only">버튼에 초점을 두고 왼쪽·오른쪽 방향키로 장면을 이동할 수 있습니다.</p>
    {reducedMotion && <p className="sp-intro-help">동작 줄이기 설정이 켜져 있습니다. 이전·다음 장면 버튼으로 살펴보세요.</p>}
    {onContinue && <div className="sp-actions"><button type="button" className={last ? 'sp-primary' : 'sp-text-button'} onClick={onContinue}>{last ? '다음: 트랜잭션과 락 →' : '도입 건너뛰고 트랜잭션 보기 →'}</button></div>}
    {onExperiment && <div className="sp-actions sp-intro-experiment"><button type="button" className={last ? 'sp-primary' : 'sp-text-button'} onClick={onExperiment} disabled={experimentDisabled}>{last ? '풀 크기 실험하기 →' : '풀 크기 실험으로 이동 →'}</button></div>}
    <details className="sp-optional sp-intro-assumptions"><summary>이 예시의 범위</summary><p>각 요청이 SQL 하나를 실행하는 예시입니다. 사용이 끝난 연결은 풀에 반납합니다. SQL 실행이 끝나는 시점과 연결을 반납하는 시점은 다를 수 있습니다.</p><p>연결을 언제 만들고 닫는지는 풀의 구현과 설정에 따라 달라집니다. 여기서는 만든 연결 C1을 유지하며 재사용합니다.</p></details>
  </section>
}
