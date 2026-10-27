'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { PMP_KEY, PMP_EVENT } from '@/lib/pmp/storage'
import {
  PMP_BACKUP_BYTES,
  PmpBackupChanged,
  applyPmpBackup,
  parsePmpBackup,
  planPmpBackup,
  type PmpBackupChoices,
  type PmpBackupConflict,
} from '@/lib/pmp/backup'
import { pmpQuestions } from '@/lib/pmp/questions'
import { libraryButton } from '@/components/library/LibraryShell'
const labels: Record<string, string> = {
  notes: '내 메모',
  thoughts: '회상 답변',
  answers: '선택한 답',
  review: '복습 일정',
  recall: '회상 상태',
  prefs: '이전 HTML 읽기 설정',
  journey: '이동 경로',
}
const rating: Record<string, string> = {
  again: '다시 보기',
  hard: '아직 어려움',
  good: '설명 가능',
}
function display(field: string, value: unknown): string {
  if (field === 'notes' || field === 'thoughts')
    return String(value) || '(빈 글)'
  if (field === 'journey') return `이동 기록 ${(value as unknown[]).length}개`
  if (field === 'review') {
    const r = value as { due: string; rating: string; interval: number }
    return `${new Date(r.due).toLocaleString('ko-KR')} · ${rating[r.rating] ?? r.rating} · 간격 ${r.interval === 0 ? '즉시' : r.interval === 1 / 1440 ? '1분' : r.interval + '일'}`
  }
  if (field === 'recall') return rating[String(value)] ?? String(value)
  if (field === 'prefs')
    return (
      (
        {
          suit: 'SUIT',
          suite: 'SUITE',
          batang: '고운바탕',
          system: '시스템 글꼴',
          dark: '어둡게',
          light: '밝게',
        } as Record<string, string>
      )[String(value)] ?? `${value}px`
    )
  return String(value)
}
function answer(c: PmpBackupConflict, value: unknown) {
  if (c.field !== 'answers') return display(c.field, value)
  const a = value as { index: number; at: string },
    option = pmpQuestions.get(c.id)!.options[a.index]
  return `${option.text}\n${option.correct ? '적절한 선택' : '다른 선택이 더 적절함'} · ${new Date(a.at).toLocaleString('ko-KR')}`
}
type Pending = { raw: string; name: string; baseline: string | null }
export function PmpBackup() {
  const [ready, setReady] = useState(false),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState<Pending | null>(null),
    [choices, setChoices] = useState<PmpBackupChoices>({}),
    [stale, setStale] = useState(false)
  const serial = useRef(0),
    formId = useId()
  useEffect(() => {
    setReady(true)
    return () => {
      serial.current++
    }
  }, [])
  useEffect(() => {
    if (!pending) return
    const check = () => {
      try {
        if (localStorage.getItem(PMP_KEY) !== pending.baseline) setStale(true)
      } catch {
        setStale(true)
      }
    }
    window.addEventListener('storage', check)
    window.addEventListener(PMP_EVENT, check)
    window.addEventListener('focus', check)
    return () => {
      window.removeEventListener('storage', check)
      window.removeEventListener(PMP_EVENT, check)
      window.removeEventListener('focus', check)
    }
  }, [pending])
  const preview = useMemo(() => {
    if (!pending) return null
    try {
      return {
        plan: planPmpBackup(pending.baseline, pending.raw, choices),
        error: '',
      }
    } catch (e) {
      return {
        plan: null,
        error: e instanceof Error ? e.message : '파일을 확인하지 못했어요.',
      }
    }
  }, [pending, choices])
  function download() {
    try {
      // Do not parse or rewrite: preserve unknown/future/malformed records as a rescue copy too.
      const raw = localStorage.getItem(PMP_KEY) ?? '{"version":1}',
        url = URL.createObjectURL(
          new Blob([raw], { type: 'application/json' }),
        ),
        a = document.createElement('a')
      a.href = url
      a.download =
        'PMP_길라잡이_기록_' + new Date().toISOString().slice(0, 10) + '.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage(
        'PMP 기록 원본을 파일로 저장했어요. 화면에만 남아 있는 미저장 글은 포함되지 않아요.',
      )
    } catch {
      setMessage(
        '브라우저 기록에 접근하지 못해 파일을 만들지 못했어요. 저장 설정을 확인해 주세요.',
      )
    }
  }
  async function load(file?: File) {
    const token = ++serial.current
    setPending(null)
    setChoices({})
    setStale(false)
    setMessage('')
    if (!file) return
    try {
      if (file.size > PMP_BACKUP_BYTES)
        throw Error('8MB 이하의 PMP 백업 파일을 골라 주세요.')
      const raw = await file.text()
      if (token !== serial.current) return
      parsePmpBackup(raw)
      const baseline = localStorage.getItem(PMP_KEY)
      planPmpBackup(baseline, raw)
      setPending({ raw, name: file.name, baseline })
    } catch (e) {
      if (token === serial.current)
        setMessage(
          (e instanceof Error ? e.message : '파일을 읽지 못했어요.') +
            ' 현재 기록은 바꾸지 않았어요.',
        )
    }
  }
  function recheck() {
    try {
      if (pending) {
        setPending({ ...pending, baseline: localStorage.getItem(PMP_KEY) })
        setChoices({})
        setStale(false)
        setMessage(
          '최신 기록으로 다시 비교했어요. 다른 내용은 다시 선택해 주세요.',
        )
      }
    } catch {
      setMessage('최신 기록을 읽지 못했어요. 파일과 현재 기록은 그대로예요.')
    }
  }
  function apply() {
    if (!pending) return
    try {
      applyPmpBackup(localStorage, pending.baseline, pending.raw, choices)
      setPending(null)
      setChoices({})
      setMessage(
        'PMP 기록을 합쳤어요. 선택한 내용만 반영했고 다른 분야의 기록은 바꾸지 않았어요.',
      )
      window.dispatchEvent(new Event(PMP_EVENT))
    } catch (e) {
      if (e instanceof PmpBackupChanged) setStale(true)
      setMessage(
        e instanceof PmpBackupChanged
          ? e.message
          : '기록을 저장하지 못했어요. 가져오기를 완료하지 않았으니 파일과 브라우저 저장 설정을 확인해 주세요.',
      )
    }
  }
  return (
    <details id="pmp-backup" className="desk-utility pmp-backup">
      <summary>PMP 기록 백업</summary>
      <p>
        읽음·이동 경로·선택한 답·메모·회상 답변·복습·나중에 읽기와 이전 HTML의
        읽기 설정을 파일로 보관해요. 이전 통합 HTML에서 내보낸 JSON도 가져올 수
        있어요.
      </p>
      <p className="study-meta">
        파일은 서버로 보내지 않아요. 서재의 글꼴·테마와 다른 분야의 기록은
        바꾸지 않아요. 현재 기록을 먼저 저장해 두면 비교 전에 되돌아갈 사본이
        남아요.
      </p>
      <div className="flex flex-wrap gap-3">
        <button className={libraryButton} disabled={!ready} onClick={download}>
          PMP 기록 원본 저장
        </button>
        <label className={libraryButton + ' cursor-pointer'}>
          PMP 백업 파일 비교
          <input
            aria-label="PMP 백업 파일 비교"
            className="sr-only"
            type="file"
            disabled={!ready}
            accept="application/json,.json"
            onChange={(e) => {
              void load(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {pending && (
        <section className="pmp-backup-preview" aria-label="PMP 백업 비교">
          <h3>가져오기 전 확인</h3>
          <p>{pending.name} · 8MB 이하</p>
          <p>
            파일에 없는 현재 기록은 남겨요. 읽음은 더 최근 시각을, 같은 답은 더
            최근 채점 기록을 사용하고 나중에 읽기와 이동 경로는 합쳐요.
          </p>
          {preview?.error && <p role="alert">{preview.error}</p>}
          {preview?.plan && (
            <>
              <p>
                {preview.plan.conflicts.length
                  ? `서로 다른 기록 ${preview.plan.conflicts.length}개를 비교해 주세요. 선택하기 전에는 저장하지 않아요.`
                  : '서로 다른 내용이 겹치지 않아요. 아래 버튼을 눌러야 가져와요.'}
              </p>
              {preview.plan.conflicts.map((c, i) => (
                <fieldset key={c.key} className="pmp-backup-conflict">
                  <legend>
                    {c.field === 'journey'
                      ? '이동 경로가 5,000개를 넘어 한쪽을 선택해야 해요.'
                      : c.field === 'prefs'
                        ? labels[c.field]
                        : `${c.id.startsWith('n') ? c.id.slice(1) + '번 수업' : '상황 문제'} · ${labels[c.field]}`}
                  </legend>
                  {c.field === 'answers' && !c.id.startsWith('n') && (
                    <p>{pmpQuestions.get(c.id)?.scene}</p>
                  )}
                  {c.field === 'prefs' && (
                    <p>
                      {
                        (
                          {
                            font: '글꼴',
                            size: '글자 크기',
                            theme: '테마',
                          } as Record<string, string>
                        )[c.id]
                      }
                    </p>
                  )}
                  {c.field === 'journey' && (
                    <p>
                      선택하지 않은 쪽의 경로는 합쳐지지 않아요. 먼저 현재
                      기록과 파일을 둘 다 보관해 주세요.
                    </p>
                  )}
                  <div className="pmp-backup-columns">
                    {(['current', 'incoming'] as const).map((side) => (
                      <label key={side}>
                        <span>
                          <input
                            type="radio"
                            name={formId + '-' + i}
                            checked={choices[c.key] === side}
                            onChange={() =>
                              setChoices({ ...choices, [c.key]: side })
                            }
                          />
                          {side === 'current'
                            ? '현재 브라우저 기록 유지'
                            : '백업 파일의 기록 사용'}
                        </span>
                        <pre>{answer(c, c[side])}</pre>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {stale && (
                <p role="alert">
                  비교하는 동안 현재 기록이 바뀌었어요. 최신 기록으로 다시
                  비교한 뒤 선택해 주세요.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                {stale ? (
                  <button className={libraryButton} onClick={recheck}>
                    최신 기록과 다시 비교
                  </button>
                ) : (
                  <button
                    className={libraryButton}
                    onClick={apply}
                    disabled={preview.plan.unresolved.length > 0}
                  >
                    선택한 내용으로 가져오기
                  </button>
                )}
                <button
                  className={libraryButton}
                  onClick={() => {
                    serial.current++
                    setPending(null)
                    setChoices({})
                    setMessage('가져오기를 취소했어요. 현재 기록은 그대로예요.')
                  }}
                >
                  취소
                </button>
              </div>
            </>
          )}
        </section>
      )}
      {pending && !preview?.plan && (
        <button
          className={libraryButton}
          onClick={() => {
            serial.current++
            setPending(null)
            setChoices({})
          }}
        >
          취소
        </button>
      )}
      <p role="status">{message}</p>
      <noscript>
        <p>
          기록 파일 저장과 비교·가져오기에는 JavaScript가 필요해요. 본문은 계속
          읽을 수 있어요.
        </p>
      </noscript>
    </details>
  )
}
