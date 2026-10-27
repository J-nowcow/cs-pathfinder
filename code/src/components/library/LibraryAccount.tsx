'use client'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { authClient } from '@/lib/auth/client'
import {
  LibraryAccountClient,
  LibraryAccountError,
} from '@/lib/library/account-client'
import { canonicalLibraryJson } from '@/lib/library/account-schema'
import { LIBRARY_EVENT } from '@/lib/library/storage'
import type { StudyEntry } from '@/lib/library/storage'

export type PendingDrafts = Map<string, { text: string; expected: string }>
type Scope = {
  id: string
  ready: boolean
  generation: number
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  pending?: PendingDrafts
}
type AccountView = {
  scope: Scope
  client: LibraryAccountClient | null
  user: { id: string; email: string } | null
  busy: boolean
  message: string
  available: boolean
  act: (
    action: 'open' | 'guest' | 'import' | 'send' | 'local' | 'remote',
    id?: string,
  ) => void
}
const Context = createContext<AccountView>({
  scope: { id: 'guest', generation: 0, ready: true },
  client: null,
  user: null,
  busy: false,
  message: '',
  available: false,
  act: () => {},
})
export const useLibraryScope = () => useContext(Context).scope
const button =
  'inline-flex min-h-11 items-center rounded-lg border border-line px-4 py-2 text-sm text-accent disabled:opacity-50'
const ACTIVE_KEY = 'pathfinder.library.account.active.v1'
function failure(error: unknown) {
  const code = error instanceof LibraryAccountError ? error.code : 'storage'
  if (code === 'owner' || code === 'unauthorized')
    return '로그인 계정이 바뀌었거나 세션이 끝났어요. 전송을 멈췄고 계정별 브라우저 기록은 남겨 뒀어요. 다시 로그인한 뒤 열어 주세요.'
  if (code === 'unavailable')
    return '계정 저장을 지금 사용할 수 없어요. 브라우저 기록은 그대로이며 나중에 다시 시도할 수 있어요.'
  if (code === 'conflict')
    return '기록이 겹치거나 다른 화면에서 바뀌었어요. 답안 백업을 받아 두고 두 기록을 비교해 주세요. 기존 답안을 덮어쓰지 않았어요.'
  if (code === 'offline')
    return '서버 응답을 받지 못했어요. 브라우저에 보관된 기록은 그대로예요. 연결된 뒤 다시 시도해 주세요.'
  if (code === 'limit')
    return '계정 전송 한도를 넘었어요. 최대 200개·요청 전체 3MB이며 답안은 항목당 6,000자까지예요. 브라우저 기록은 남아 있으니 백업을 받아 두고 분량을 확인해 주세요.'
  return '기록을 안전하게 읽거나 저장하지 못했어요. 기존 기록은 초기화하지 않았어요. 입력 중인 답안을 복사해 두고 저장 공간과 백업을 확인해 주세요.'
}
export function LibraryAccountProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: React.ReactNode
}) {
  return enabled ? (
    <EnabledLibraryAccount>{children}</EnabledLibraryAccount>
  ) : (
    children
  )
}
function EnabledLibraryAccount({ children }: { children: React.ReactNode }) {
  const { data, isPending } = authClient.useSession()
  const user =
    !isPending && data ? { id: data.user.id, email: data.user.email } : null
  const ownerRef = useRef<string | null>(null)
  ownerRef.current = user?.id ?? null
  const [active, setActive] = useState<LibraryAccountClient | null>(null)
  const [resolvedOwner, setResolvedOwner] = useState<string | null | undefined>(
    undefined,
  )
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const [, tick] = useState(0),
    [generation, setGeneration] = useState(0)
  const drafts = useRef(new Map<string, PendingDrafts>())
  const clients = useRef(new Set<LibraryAccountClient>())
  const client = active?.owner === user?.id ? active : null
  const createClient = (owner: string) => {
    const next = new LibraryAccountClient(
      owner,
      localStorage,
      fetch,
      () => ownerRef.current,
      (refresh) => {
        tick((n) => n + 1)
        if (refresh) setGeneration((n) => n + 1)
        window.dispatchEvent(new Event(LIBRARY_EVENT))
      },
    )
    clients.current.add(next)
    return next
  }
  useEffect(
    () => () => {
      for (const connection of clients.current) connection.dispose()
    },
    [],
  )
  useEffect(() => {
    if (isPending) return
    let cancelled = false,
      restoring: LibraryAccountClient | null = null
    if (active && active.owner !== ownerRef.current) {
      active.dispose()
      setActive(null)
      try {
        sessionStorage.removeItem(ACTIVE_KEY)
      } catch {}
      setMessage(
        '로그인 계정이 바뀌어 손님 기록으로 돌아왔어요. 이전 계정의 전송 대기 기록은 따로 남아 있어요.',
      )
    }
    const owner = ownerRef.current
    const restore = async () => {
      try {
        if (owner && sessionStorage.getItem(ACTIVE_KEY) === owner) {
          setBusy(true)
          restoring = createClient(owner)
          await restoring.open()
          if (!cancelled) setActive(restoring)
        }
      } catch (error) {
        if (!cancelled) setMessage(failure(error))
      } finally {
        if (!cancelled) {
          setResolvedOwner(owner)
          setBusy(false)
        }
      }
    }
    void restore()
    return () => {
      cancelled = true
      restoring?.dispose()
    }
  }, [user?.id, isPending])
  useEffect(() => () => active?.dispose(), [active])
  useEffect(() => {
    const refresh = () => tick((n) => n + 1)
    const warn = (event: BeforeUnloadEvent) => {
      if (![...drafts.current.values()].some((map) => map.size)) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('storage', refresh)
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('beforeunload', warn)
    }
  }, [])
  const scope = useMemo(() => {
    const ready = !isPending && resolvedOwner === (user?.id ?? null)
    const id = !ready ? 'loading' : client ? 'account:' + client.owner : 'guest'
    if (!drafts.current.has(id)) drafts.current.set(id, new Map())
    return {
      id,
      ready,
      generation,
      pending: drafts.current.get(id)!,
      storage: client?.scopedStorage(),
    }
  }, [client, generation, resolvedOwner, isPending, user?.id])
  const act = async (
    action: Parameters<AccountView['act']>[0],
    id?: string,
  ) => {
    if (busy) return
    if (action === 'guest') {
      try {
        sessionStorage.removeItem(ACTIVE_KEY)
      } catch {
        setMessage(failure(new LibraryAccountError('storage')))
        return
      }
      active?.dispose()
      setActive(null)
      setMessage(
        '이 브라우저의 손님 기록으로 돌아왔어요. 계정별 전송 대기 기록은 따로 남아 있어요.',
      )
      return
    }
    setBusy(true)
    setMessage('')
    try {
      if (action === 'open') {
        const owner = ownerRef.current
        if (!owner) throw new LibraryAccountError('unauthorized')
        const next = createClient(owner)
        await next.open()
        sessionStorage.setItem(ACTIVE_KEY, owner)
        setActive(next)
        setResolvedOwner(owner)
        setMessage('이 계정의 기록을 열었어요. 손님 기록은 가져오지 않았어요.')
      } else {
        if (!client) throw new LibraryAccountError('owner')
        if (action === 'import') {
          client.importGuest()
          setMessage(
            '손님 기록을 계정용 브라우저 보관함에 합쳤어요. 원본은 그대로예요. 계정에 보내려면 아래 저장 버튼을 눌러 주세요.',
          )
        } else if (action === 'send') {
          await client.flush()
          const e = client.get()
          setMessage(
            e.conflict
              ? '서로 다른 변경이 있어 전송을 멈췄어요. 아래에서 항목별로 비교해 주세요.'
              : canonicalLibraryJson(e.working) ===
                  canonicalLibraryJson(e.base.state)
                ? '이 계정의 서버 기록과 같음을 확인했어요.'
                : '이전 전송을 확인했어요. 그동안 수정한 내용이 남아 있으니 한 번 더 저장해 주세요.',
          )
        } else if (id) {
          client.resolve(id, action)
          setMessage(
            '선택한 기록을 브라우저 보관함에 반영했어요. 모든 충돌을 고른 뒤 계정에 저장해 주세요.',
          )
        }
      }
    } catch (error) {
      setMessage(failure(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Context.Provider
      value={{
        scope,
        client,
        user,
        busy,
        message,
        available: true,
        act: (action, id) => {
          void act(action, id)
        },
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function LibraryAccountPanel() {
  const { available, client, user, busy, message, act } = useContext(Context)
  if (!available) return null
  let envelope: ReturnType<LibraryAccountClient['get']> | null = null
  try {
    envelope = client?.get() ?? null
  } catch {}
  const waiting =
    envelope &&
    (envelope.pending ||
      canonicalLibraryJson(envelope.working) !==
        canonicalLibraryJson(envelope.base.state))
  return (
    <details className="desk-utility mt-6" id="library-account">
      <summary>기술사·Jira 과제 계정 저장</summary>
      <p className="mt-3 text-sm leading-7 text-muted">
        기술사 답안과 Jira 과제의 체크·복습 날짜·읽은 시각을 저장합니다.
        PMP·정처기·Jira 기본 수업과 CS 답변 초안은 포함하지 않아요. 답안을 AI에
        보내지 않습니다.
      </p>
      {user ? (
        <p className="study-meta break-all">
          로그인: {user.email} ·{' '}
          {client ? '계정용 기록을 보는 중' : '손님 기록을 보는 중'}
        </p>
      ) : (
        <p className="study-meta">
          로그인하지 않아도 브라우저 기록과 백업을 사용할 수 있어요.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {!user && (
          <a className={button} href="/me">
            로그인 화면으로
          </a>
        )}
        {user && !client && (
          <button
            className={button}
            disabled={busy}
            onClick={() => act('open')}
          >
            이 계정의 기록 열기
          </button>
        )}
        {client && (
          <>
            <button
              className={button}
              disabled={busy}
              onClick={() => act('send')}
            >
              {envelope?.pending ? '전송 다시 확인하기' : '계정에 저장하기'}
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={() => act('guest')}
            >
              손님 기록 보기
            </button>
            <details className="w-full mt-2">
              <summary>이 브라우저의 손님 기록 가져오기</summary>
              <p className="study-meta">
                손님 기록 전체를 이 계정의 보관함에 복사합니다. 같은 항목에 서로
                다른 내용이 있으면 가져오지 않아요. 아래 답안 백업을 먼저 받아
                두세요.
              </p>
              <button
                className={button}
                disabled={
                  busy || Boolean(envelope?.pending || envelope?.conflict)
                }
                onClick={() => act('import')}
              >
                손님 기록을 이 계정 보관함에 복사
              </button>
            </details>
          </>
        )}
      </div>
      {client && (
        <p className="study-meta">
          {busy
            ? '확인 중…'
            : envelope?.conflict
              ? '충돌 해결 대기'
              : waiting
                ? '브라우저 보관 · 계정 전송 대기'
                : '확인한 계정 기록과 같음'}{' '}
          · 답안 입력은 우선 브라우저에 저장됩니다.
        </p>
      )}
      {envelope?.conflict?.ids.map((id) => (
        <section
          key={id}
          className="mt-5 border-t border-line pt-4"
          aria-label="계정 답안 충돌 비교"
        >
          <h3 className="font-semibold">
            {envelope!.working.entries[id]?.title ??
              envelope!.conflict!.remote.state.entries[id]?.title ??
              id}
          </h3>
          <dl className="mt-3 space-y-3 text-sm leading-7">
            <div>
              <dt>이 브라우저 답안</dt>
              <dd className="whitespace-pre-wrap break-words">
                {envelope!.working.entries[id]?.draft || '(비어 있음)'}
              </dd>
            </div>
            <div>
              <dt>계정에 저장된 답안</dt>
              <dd className="whitespace-pre-wrap break-words">
                {envelope!.conflict!.remote.state.entries[id]?.draft ||
                  '(비어 있음)'}
              </dd>
            </div>
          </dl>
          <p className="study-meta">
            브라우저 항목:{' '}
            <RecordDetails entry={envelope!.working.entries[id]} />
          </p>
          <p className="study-meta">
            계정 항목:{' '}
            <RecordDetails
              entry={envelope!.conflict!.remote.state.entries[id]}
            />
          </p>
          <details className="mt-3 text-sm leading-7">
            <summary>비교 기준 기록 보기</summary>
            <p className="whitespace-pre-wrap break-words">
              {envelope!.conflict!.ancestor.entries[id]?.draft || '(비어 있음)'}
            </p>
            <RecordDetails entry={envelope!.conflict!.ancestor.entries[id]} />
          </details>
          <p className="study-meta">
            체크·복습 표시도 선택한 항목의 기록을 사용합니다. 필요한 내용을 먼저
            복사해 두세요.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className={button}
              disabled={busy}
              onClick={() => act('local', id)}
            >
              이 브라우저 항목 유지
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={() => act('remote', id)}
            >
              계정 항목 사용
            </button>
          </div>
        </section>
      ))}
      <p role="status" className="mt-4 text-sm text-muted">
        {message}
      </p>
      <p className="study-meta">
        로그아웃해도 계정용 브라우저 사본은 이 기기에 남습니다. 공유 기기에서는
        백업 후 사이트 데이터를 지워 주세요. 탈퇴하면 서버의 계정 기록은
        삭제되지만 브라우저 사본과 다운로드 파일은 별도로 지워야 합니다.
      </p>
    </details>
  )
}
function RecordDetails({ entry }: { entry?: StudyEntry }) {
  if (!entry) return <span>항목 없음</span>
  return (
    <span>
      체크 {entry.checks.length ? entry.checks.join(' · ') : '없음'} /{' '}
      {entry.status === 'comfortable'
        ? '설명 가능'
        : entry.status === 'review'
          ? '복습 예정'
          : '학습 중'}{' '}
      / 복습 {entry.due ?? '날짜 없음'}
    </span>
  )
}
