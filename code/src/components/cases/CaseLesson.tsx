'use client'

import { useEffect, useRef, useState } from 'react'
import { roles, source, translations, type Locale, type Role } from '@/lib/cases/content'
import {
  CASE_STORAGE_KEY, changeRoleRecord, emptySession, parseSession, persistSession,
  reviewDate, type CaseSession, type RoleRecord,
} from '@/lib/cases/storage'
import { copy } from './copy'

const assistanceValues = ['unspecified', 'reported-none', 'reported-help'] as const

export function CaseLesson() {
  const [locale, setLocale] = useState<Locale>('ko')
  const [session, setSession] = useState<CaseSession>(emptySession)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<'saved' | 'failure' | 'loadFailure' | null>(null)
  const [dirty, setDirty] = useState(false)
  const [recalling, setRecalling] = useState(false)
  const baseline = useRef<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const t = translations[locale]
  const ui = copy[locale]
  const role = session.role
  const task = t.roles[role]
  const record = session.records[role]

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CASE_STORAGE_KEY)
      const parsed = parseSession(raw)
      baseline.current = raw
      setSession(parsed)
      const restored = parsed.records[parsed.role]
      setRecalling(restored.stage === 3 && !restored.recalled)
    } catch { setNotice('loadFailure') }
    setReady(true)
  }, [])
  useEffect(() => {
    if (!dirty) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty])

  function update(patch: Partial<RoleRecord>) {
    setSession(current => changeRoleRecord(current, current.role, patch))
    setDirty(true)
    if (notice === 'saved') setNotice(null)
  }
  function go(patch: Partial<RoleRecord>) {
    update(patch)
    requestAnimationFrame(() => heading.current?.focus())
  }
  function save(next = session) {
    try {
      baseline.current = persistSession(localStorage, next, baseline.current)
      setNotice('saved')
      setDirty(false)
    } catch { setNotice('failure') }
  }
  function selectRole(next: Role) {
    setSession(current => ({ ...current, role: next }))
    const nextRecord = session.records[next]
    setRecalling(nextRecord.stage === 3 && !nextRecord.recalled)
    setDirty(true)
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'cs-pathfinder-github-migration-answers.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function help(field: 'externalHelp' | 'transferHelp' | 'recallHelp') {
    return <div className="case-help">
      <label htmlFor={`case-${field}`}>{ui.help}</label>
      <select id={`case-${field}`} value={record[field]} onChange={event => update({ [field]: event.target.value })}>
        {assistanceValues.map((value, i) => <option key={value} value={value}>{ui.helpOptions[i]}</option>)}
      </select>
      <p className="case-caption">{ui.helpNote}</p>
    </div>
  }
  function input(field: 'draft' | 'revision' | 'transfer' | 'recall', label: string) {
    return <div className="case-answer">
      <label htmlFor={`case-${field}`}>{label}</label>
      <textarea id={`case-${field}`} value={record[field]} maxLength={6000} rows={6}
        onChange={event => update({ [field]: event.target.value })} />
      <span className="case-caption">{record[field].length} / 6000</span>
    </div>
  }
  function snapshot(title: string, value: string) {
    return <div className="case-snapshot"><h3>{title}</h3><p>{value}</p></div>
  }
  const example = <aside className="case-example"><h3>{ui.sampleTitle}</h3><p>{task.example}</p><p className="case-caption">{ui.sampleNote}</p></aside>
  const firstContext = record.first && <p className="case-caption">
    {record.first.exampleViewed ? ui.sampleContext : ui.noSampleContext}{' '}
    {ui.helpOptions[assistanceValues.indexOf(record.first.assistance)]}
  </p>

  return <article className="case-lesson" lang={locale}>
    <div className="case-language" role="group" aria-label="Language / 언어">
      <button type="button" lang="ko" aria-pressed={locale === 'ko'} onClick={() => setLocale('ko')}>한국어</button>
      <button type="button" lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>English</button>
    </div>
    <header className="case-intro">
      <p className="case-kicker">01 / GitHub · 2026</p>
      <h1>{t.title}</h1><p className="case-lead">{t.lead}</p><p className="case-caption">{t.scope}</p>
    </header>
    <section className="case-evidence" aria-labelledby="case-facts">
      <h2 id="case-facts">{ui.facts}</h2><p className="case-caption">{ui.factsNote}</p>
      <ol>{t.facts.map(fact => <li key={fact}>{fact}</li>)}</ol>
      <a href={source.url}>{ui.source} ↗</a><p className="case-caption">{ui.sourceMeta}</p>
      <details><summary>{ui.glossary}</summary><dl>{t.glossary.map(term => <div key={term.term}>
        <dt>{term.term}</dt><dd>{term.meaning} {term.href && <a href={term.href}>{ui.related}</a>}</dd>
      </div>)}</dl></details>
    </section>
    <noscript><p>{ui.nojs}</p></noscript>
    {!ready ? <p role="status">{ui.ready}</p> : <>
      <fieldset className="case-roles"><legend>{ui.role}</legend>
        {roles.map(value => <label key={value} className={value === role ? 'case-role-selected' : ''}>
          <input type="radio" name="case-role" value={value} checked={value === role} onChange={() => selectRole(value)} />
          {t.roles[value].name}
        </label>)}
      </fieldset>
      <p className="case-goal"><strong>{ui.objective}</strong><br />{task.goal}</p>
      <ol className="case-steps" aria-label={locale === 'ko' ? '학습 단계' : 'Learning steps'}>
        {ui.steps.map((step, i) => <li key={step} aria-current={record.stage === i ? 'step' : undefined}>
          <span>{i + 1}</span>{step}
        </li>)}
      </ol>
      <section className="case-work" aria-labelledby="case-step-heading">
        <h2 id="case-step-heading" ref={heading} tabIndex={-1}>{ui.steps[record.stage]}</h2>
        {record.stage === 0 && <>
          <p>{task.prompt}</p>
          <details key={role} onToggle={event => {
            if (event.currentTarget.open && !record.viewedExample) update({ viewedExample: true })
          }}><summary>{ui.sample}</summary>{example}</details>
          {input('draft', ui.initial)}{help('externalHelp')}
          <button className="case-primary" disabled={!record.draft.trim()} onClick={() => go({
            first: { text: record.draft, assistance: record.externalHelp, exampleViewed: record.viewedExample, at: new Date().toISOString() }, stage: 1,
          })}>{ui.commit}</button>
        </>}
        {record.stage === 1 && <>
          {snapshot(ui.first, record.first!.text)}{firstContext}
          <h3>{ui.report}</h3><p>{t.outcome}</p>
          {example}
          <h3>{ui.reasoning}</h3><ul>{t.principles.map(item => <li key={item}>{item}</li>)}</ul>
          <ul className="case-check-prompts">{task.checks.map(item => <li key={item}>{item}</li>)}</ul>
          {input('revision', ui.revise)}
          <button className="case-primary" disabled={!record.revision.trim()} onClick={() => go({ stage: 2 })}>{ui.next}</button>
        </>}
        {record.stage === 2 && <>
          <h3>{ui.variation}</h3><p className="case-variation">{t.variation}</p><p>{task.transferPrompt}</p>
          {input('transfer', ui.transfer)}{help('transferHelp')}
          <div className="case-actions"><button onClick={() => go({ stage: 1 })}>{ui.back}</button>
            <button className="case-primary" disabled={!record.transfer.trim()} onClick={() => go({
              applied: { text: record.transfer, assistance: record.transferHelp, at: new Date().toISOString() }, stage: 3,
            })}>{ui.apply}</button></div>
        </>}
        {record.stage === 3 && <>
          {record.reviewAt && <p className="case-caption">{ui.due}: <time dateTime={record.reviewAt}>{new Date(record.reviewAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-GB')}</time></p>}
          {recalling && !record.recalled ? <>
            <p>{task.recallPrompt}</p><p className="case-caption">{ui.recallNote}</p>
            {input('recall', ui.recall)}{help('recallHelp')}
            <button className="case-primary" disabled={!record.recall.trim()} onClick={() => {
              update({ recalled: { text: record.recall, assistance: record.recallHelp, at: new Date().toISOString() } })
              setRecalling(false)
            }}>{ui.recallSubmit}</button>
          </> : <>
            {record.recalled && <>
              {snapshot(ui.recalled, record.recalled.text)}
              <p className="case-caption">{ui.recordedAt}: <time dateTime={record.recalled.at}>{new Date(record.recalled.at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-GB')}</time></p>
              <p className="case-caption">{ui.elapsed}: {Math.max(0, (Date.parse(record.recalled.at) - Date.parse(record.applied!.at)) / 3_600_000).toFixed(1)} {ui.hours} · {ui.helpOptions[assistanceValues.indexOf(record.recalled.assistance)]}</p>
              <h3>{ui.compare}</h3>
            </>}
            {snapshot(ui.applied, record.applied!.text)}
            <p className="case-caption">{ui.helpOptions[assistanceValues.indexOf(record.applied!.assistance)]}</p>
            <fieldset className="case-checks"><legend>{ui.checks}</legend><p className="case-caption">{ui.checksNote}</p>
              {task.transferChecks.map((check, i) => <label key={check}>
                <input type="checkbox" checked={record.checks.includes(i)} onChange={event => update({
                  checks: event.target.checked ? [...record.checks, i] : record.checks.filter(value => value !== i),
                })} />{check}</label>)}
            </fieldset>
            {record.recalled ? <>
              {snapshot(ui.first, record.first!.text)}{firstContext}{snapshot(ui.revised, record.revision)}{example}
            </> : <>
              <h3>{ui.review}</h3><p>{ui.schedule}</p>
              <div className="case-actions">{([1, 3] as const).map(days => <button key={days} onClick={() => {
                const next = changeRoleRecord(session, role, { reviewAt: reviewDate(days) })
                setSession(next); setDirty(true); save(next)
              }}>{days === 1 ? ui.tomorrow : ui.three}</button>)}</div>
              <button className="case-primary" onClick={() => { setRecalling(true); requestAnimationFrame(() => heading.current?.focus()) }}>{ui.recallNow}</button>
            </>}
          </>}
        </>}
      </section>
      <footer className="case-save">
        <p>{ui.local}</p>
        <div className="case-actions"><button className="case-primary" onClick={() => save()}>{ui.save}</button><button onClick={download}>{ui.export}</button></div>
        <p role={notice === 'failure' || notice === 'loadFailure' ? 'alert' : 'status'}>
          {notice && notice !== 'saved' ? ui[notice] : dirty ? ui.dirty : notice ? ui[notice] : ''}
        </p>
      </footer>
    </>}
  </article>
}
