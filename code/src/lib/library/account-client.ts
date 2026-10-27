import { z } from 'zod'
import {
  canonicalLibraryJson,
  libraryAccountStateSchema,
  libraryWriteSchema,
  MAX_LIBRARY_REVISION,
  MAX_LIBRARY_BYTES,
  type LibrarySnapshot,
} from './account-schema'
import { LIBRARY_KEY, type LibraryState, type StudyEntry } from './storage'
import { readLibraryStrict } from './local-edit'

type Store = Pick<Storage, 'getItem' | 'setItem'>
const snapshotSchema = z
  .object({
    revision: z.number().int().min(0).max(MAX_LIBRARY_REVISION),
    state: libraryAccountStateSchema,
  })
  .strict()
const conflictSchema = z
  .object({
    remote: snapshotSchema,
    ancestor: libraryAccountStateSchema,
    ids: z.array(z.string()).max(200),
  })
  .strict()
const envelopeSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.string().min(1).max(200),
    base: snapshotSchema,
    working: libraryAccountStateSchema,
    pending: libraryWriteSchema.optional(),
    conflict: conflictSchema.optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (
      (e.pending && e.conflict) ||
      (e.pending && e.pending.baseRevision !== e.base.revision) ||
      (e.conflict &&
        (e.conflict.remote.revision < e.base.revision ||
          new Set(e.conflict.ids).size !== e.conflict.ids.length))
    )
      ctx.addIssue({ code: 'custom', message: 'inconsistent_envelope' })
  })
export type LibraryAccountEnvelope = z.infer<typeof envelopeSchema>
export const libraryAccountKey = (owner: string) =>
  'pathfinder.library.account.v1:' + encodeURIComponent(owner)
const same = (a: unknown, b: unknown) =>
  canonicalLibraryJson(a) === canonicalLibraryJson(b)
export class LibraryAccountError extends Error {
  constructor(
    public code:
      | 'owner'
      | 'storage'
      | 'format'
      | 'offline'
      | 'unavailable'
      | 'unauthorized'
      | 'conflict'
      | 'response'
      | 'limit',
  ) {
    super(code)
  }
}

/** Independent fields merge; different edits to one field require a choice. */
export function reconcileLibrary(
  base: LibraryState,
  local: LibraryState,
  remote: LibraryState,
) {
  const entries: LibraryState['entries'] = {},
    conflicts: string[] = []
  for (const id of new Set([
    ...Object.keys(base.entries),
    ...Object.keys(local.entries),
    ...Object.keys(remote.entries),
  ])) {
    const b = base.entries[id],
      l = local.entries[id],
      r = remote.entries[id]
    if (same(l, b) || same(l, r)) {
      if (r) entries[id] = r
      continue
    }
    if (same(r, b)) {
      if (l) entries[id] = l
      continue
    }
    if (!b || !l || !r) {
      conflicts.push(id)
      if (l) entries[id] = l
      continue
    }
    const merged: Record<string, unknown> = {}
    let conflict = false
    for (const field of new Set([
      ...Object.keys(b),
      ...Object.keys(l),
      ...Object.keys(r),
    ])) {
      const k = field as keyof StudyEntry
      if (same(l[k], b[k]) || same(l[k], r[k])) merged[k] = r[k]
      else if (same(r[k], b[k])) merged[k] = l[k]
      // Timestamps describe the combined edit, not competing answer content.
      else if (k === 'updatedAt' || k === 'visitedAt')
        merged[k] = Date.parse(l[k]) >= Date.parse(r[k]) ? l[k] : r[k]
      else {
        conflict = true
        merged[k] = l[k]
      }
    }
    if (conflict) {
      conflicts.push(id)
      // Preserve the complete local entry until the user chooses an entry.
      entries[id] = l
    } else entries[id] = merged as StudyEntry
  }
  const state = { version: 1 as const, entries }
  if (!libraryAccountStateSchema.safeParse(state).success)
    throw new LibraryAccountError('limit')
  return { state, conflicts }
}

export type AccountTransport = (
  url: string,
  init?: RequestInit,
) => Promise<Response>
/** One session owner per instance. Never rewrites the guest key. */
export class LibraryAccountClient {
  private inflight: Promise<void> | null = null
  private dead = false
  private requests = new Set<AbortController>()
  constructor(
    readonly owner: string,
    private storage: Store,
    private transport: AccountTransport,
    private currentOwner: () => string | null,
    private changed: (refreshEditor: boolean) => void = () => {},
    private uuid: () => string = () => crypto.randomUUID(),
  ) {
    if (!owner || owner.length > 200) throw new LibraryAccountError('owner')
  }
  dispose() {
    this.dead = true
    for (const request of this.requests) request.abort()
  }
  private guard() {
    if (this.dead || this.currentOwner() !== this.owner)
      throw new LibraryAccountError('owner')
  }
  private read() {
    this.guard()
    try {
      const raw = this.storage.getItem(libraryAccountKey(this.owner))
      if (raw === null) return { raw, envelope: null }
      const envelope = envelopeSchema.parse(JSON.parse(raw))
      if (envelope.ownerId !== this.owner)
        throw new LibraryAccountError('owner')
      return { raw, envelope }
    } catch (e) {
      if (e instanceof LibraryAccountError) throw e
      throw new LibraryAccountError(
        e instanceof z.ZodError || e instanceof SyntaxError
          ? 'format'
          : 'storage',
      )
    }
  }
  private write(
    raw: string | null,
    envelope: LibraryAccountEnvelope,
    refreshEditor = false,
  ) {
    this.guard()
    if (!envelopeSchema.safeParse(envelope).success)
      throw new LibraryAccountError('format')
    try {
      if (this.storage.getItem(libraryAccountKey(this.owner)) !== raw)
        throw new LibraryAccountError('conflict')
      this.storage.setItem(
        libraryAccountKey(this.owner),
        JSON.stringify(envelope),
      )
    } catch (e) {
      if (e instanceof LibraryAccountError) throw e
      throw new LibraryAccountError('storage')
    }
    this.changed(refreshEditor)
    return envelope
  }
  get() {
    const e = this.read().envelope
    if (!e) throw new LibraryAccountError('format')
    return e
  }
  private accept(
    envelope: LibraryAccountEnvelope,
    remote: LibrarySnapshot,
    ancestor = envelope.base.state,
  ) {
    const merged = reconcileLibrary(ancestor, envelope.working, remote.state)
    return {
      version: 1 as const,
      ownerId: this.owner,
      base: merged.conflicts.length ? envelope.base : remote,
      working: merged.state,
      ...(merged.conflicts.length
        ? { conflict: { remote, ancestor, ids: merged.conflicts } }
        : {}),
    }
  }
  private async request(init?: RequestInit) {
    this.guard()
    const controller = new AbortController()
    this.requests.add(controller)
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      let res: Response
      try {
      const transport = this.transport
      res = await transport('/api/library-study', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
          ...init,
        })
      } catch {
        this.guard()
        throw new LibraryAccountError('offline')
      }
      this.guard()
      if (res.status === 401) throw new LibraryAccountError('unauthorized')
      if (res.status === 503) throw new LibraryAccountError('unavailable')
      if (res.status === 413) throw new LibraryAccountError('limit')
      let body: unknown
      try {
        body = await res.json()
      } catch {
        throw new LibraryAccountError('response')
      }
      this.guard()
      if (
        typeof body !== 'object' ||
        body === null ||
        !('ownerId' in body) ||
        body.ownerId !== this.owner
      )
        throw new LibraryAccountError('owner')
      return { res, body }
    } finally {
      clearTimeout(timer)
      this.requests.delete(controller)
    }
  }
  async open() {
    // Validate local bytes before fetching; corrupt data is never reset.
    this.read()
    const { res, body } = await this.request()
    if (!res.ok) throw new LibraryAccountError('response')
    const parsed = snapshotSchema
      .extend({ ownerId: z.literal(this.owner) })
      .strict()
      .safeParse(body)
    if (!parsed.success) throw new LibraryAccountError('response')
    const remote = { revision: parsed.data.revision, state: parsed.data.state }
    const { raw, envelope } = this.read()
    if (envelope?.pending) return envelope // Retry the identical request before adopting a GET.
    if (envelope && remote.revision < envelope.base.revision)
      throw new LibraryAccountError('response')
    return this.write(
      raw,
      envelope
        ? this.accept(envelope, remote)
        : {
            version: 1,
            ownerId: this.owner,
            base: remote,
            working: remote.state,
          },
      true,
    )
  }
  /** Existing strict editor/backup adapter sees only this owner's working state. */
  scopedStorage(): Store {
    let observed: string | null = null
    return {
      getItem: (key) => {
        if (key !== LIBRARY_KEY) return this.storage.getItem(key)
        observed = JSON.stringify(this.get().working)
        return observed
      },
      setItem: (key, rawState) => {
        if (key !== LIBRARY_KEY) throw new LibraryAccountError('format')
        const { raw, envelope } = this.read()
        if (!envelope || observed !== JSON.stringify(envelope.working))
          throw new LibraryAccountError('conflict')
        let working: LibraryState
        try {
          working = libraryAccountStateSchema.parse(JSON.parse(rawState))
        } catch {
          throw new LibraryAccountError('format')
        }
        this.write(raw, { ...envelope, working })
      },
    }
  }
  importGuest() {
    const incoming = readLibraryStrict(this.storage),
      { raw, envelope } = this.read()
    if (!envelope || envelope.pending || envelope.conflict)
      throw new LibraryAccountError('conflict')
    const merged = reconcileLibrary(
      { version: 1, entries: {} },
      envelope.working,
      incoming,
    )
    if (merged.conflicts.length) throw new LibraryAccountError('conflict')
    return this.write(raw, { ...envelope, working: merged.state }, true)
  }
  resolve(id: string, choice: 'local' | 'remote') {
    const { raw, envelope } = this.read()
    if (!envelope?.conflict?.ids.includes(id))
      throw new LibraryAccountError('conflict')
    const entries = { ...envelope.working.entries }
    if (choice === 'remote') {
      const selected = envelope.conflict.remote.state.entries[id]
      if (selected) entries[id] = selected
      else delete entries[id]
    }
    const ids = envelope.conflict.ids.filter((v) => v !== id)
    const next = {
      ...envelope,
      working: { version: 1 as const, entries },
      ...(ids.length
        ? { conflict: { ...envelope.conflict, ids } }
        : { base: envelope.conflict.remote }),
    }
    if (!ids.length) delete next.conflict
    return this.write(raw, next, true)
  }
  flush(): Promise<void> {
    if (!this.inflight)
      this.inflight = this.send().finally(() => {
        this.inflight = null
      })
    return this.inflight
  }
  private async send() {
    let { raw, envelope } = this.read()
    if (!envelope || envelope.conflict)
      throw new LibraryAccountError('conflict')
    if (!envelope.pending) {
      if (same(envelope.working, envelope.base.state)) return
      if (envelope.base.revision >= MAX_LIBRARY_REVISION)
        throw new LibraryAccountError('limit')
      const pending = {
        baseRevision: envelope.base.revision,
        requestId: this.uuid(),
        state: envelope.working,
      }
      if (
        new TextEncoder().encode(JSON.stringify(pending)).byteLength >
        MAX_LIBRARY_BYTES
      )
        throw new LibraryAccountError('limit')
      envelope = this.write(raw, {
        ...envelope,
        pending,
      })
    }
    const pending = envelope.pending!
    const { res, body } = await this.request({
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-library-owner': this.owner,
      },
      body: JSON.stringify(pending),
    })
    const responseSchema = z.discriminatedUnion('kind', [
      z
        .object({
          ownerId: z.literal(this.owner),
          kind: z.literal('ok'),
          snapshot: snapshotSchema,
          acknowledgedRevision: z.number().int(),
          replayed: z.boolean(),
        })
        .strict(),
      z
        .object({
          ownerId: z.literal(this.owner),
          kind: z.literal('conflict'),
          snapshot: snapshotSchema,
        })
        .strict(),
      z
        .object({
          ownerId: z.literal(this.owner),
          kind: z.literal('request_id_reused'),
        })
        .strict(),
    ])
    const parsed = responseSchema.safeParse(body)
    if (!parsed.success || (res.status !== 200 && res.status !== 409))
      throw new LibraryAccountError('response')
    const result = parsed.data
    if (result.kind === 'request_id_reused')
      throw new LibraryAccountError('response')
    if (
      result.kind === 'ok' &&
      (res.status !== 200 ||
        result.acknowledgedRevision !== pending.baseRevision + 1 ||
        result.snapshot.revision < result.acknowledgedRevision ||
        (result.snapshot.revision === result.acknowledgedRevision && !same(result.snapshot.state, pending.state)))
    )
      throw new LibraryAccountError('response')
    if (
      result.kind === 'conflict' &&
      (res.status !== 409 || result.snapshot.revision < pending.baseRevision)
    )
      throw new LibraryAccountError('response')
    const latest = this.read()
    if (latest.envelope?.pending?.requestId !== pending.requestId)
      throw new LibraryAccountError('conflict')
    // Edits made during the request stay in working; late replays may include newer server changes.
    this.write(
      latest.raw,
      this.accept(
        latest.envelope,
        result.snapshot,
        result.kind === 'ok' ? pending.state : latest.envelope.base.state,
      ),
      true,
    )
  }
}
