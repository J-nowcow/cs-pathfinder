import { z } from 'zod'
import { CASE_ID, CONTENT_VERSION, roles, type Role } from './content'

export const CASE_STORAGE_KEY = `pathfinder.case.${CASE_ID}.v1`
const answer = z.string().max(6000)
const assistance = z.enum(['unspecified', 'reported-none', 'reported-help'])
const submission = z.object({
  text: answer.min(1).refine(value => value.trim().length > 0),
  assistance,
  exampleViewed: z.boolean().optional(),
  at: z.string().datetime(),
}).strict()
const roleSchema = z.object({
  stage: z.number().int().min(0).max(3),
  draft: answer,
  viewedExample: z.boolean(),
  externalHelp: assistance,
  first: submission.extend({ exampleViewed: z.boolean() }).optional(),
  revision: answer,
  transfer: answer,
  transferHelp: assistance,
  applied: submission.optional(),
  checks: z.array(z.number().int().min(0).max(2)).max(3),
  recall: answer,
  recallHelp: assistance,
  recalled: submission.optional(),
  reviewAt: z.string().datetime().optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.stage >= 1 && !value.first) ||
      (value.stage >= 2 && !value.revision.trim()) ||
      (value.stage >= 3 && !value.applied)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Incomplete stage' })
  }
})
const sessionSchema = z.object({
  version: z.literal(1),
  contentVersion: z.literal(CONTENT_VERSION),
  role: z.enum(roles),
  records: z.object({ developer: roleSchema, project: roleSchema, product: roleSchema }).strict(),
}).strict()
export type RoleRecord = z.infer<typeof roleSchema>
export type CaseSession = z.infer<typeof sessionSchema>
export const emptyRole = (): RoleRecord => ({
  stage: 0, draft: '', viewedExample: false, externalHelp: 'unspecified',
  revision: '', transfer: '', transferHelp: 'unspecified', checks: [],
  recall: '', recallHelp: 'unspecified',
})
export const emptySession = (): CaseSession => ({
  version: 1, contentVersion: CONTENT_VERSION, role: 'developer',
  records: { developer: emptyRole(), project: emptyRole(), product: emptyRole() },
})
export function parseSession(raw: string | null): CaseSession {
  if (raw !== null && raw.length > 200_000) throw Error('CASE_TOO_LARGE')
  return raw === null ? emptySession() : sessionSchema.parse(JSON.parse(raw))
}
export function changeRoleRecord(session: CaseSession, role: Role, patch: Partial<RoleRecord>): CaseSession {
  return { ...session, records: { ...session.records, [role]: { ...session.records[role], ...patch } } }
}
// Compare the exact last-read value before writing. Malformed, incompatible,
// or concurrently edited records are never silently replaced.
export function persistSession(storage: Pick<Storage, 'getItem' | 'setItem'>, session: CaseSession, expected: string | null): string {
  const current = storage.getItem(CASE_STORAGE_KEY)
  parseSession(current)
  if (current !== expected) throw Error('CASE_CONFLICT')
  const raw = JSON.stringify(sessionSchema.parse(session))
  storage.setItem(CASE_STORAGE_KEY, raw)
  return raw
}
export function reviewDate(days: 1 | 3, now = new Date()): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString()
}
