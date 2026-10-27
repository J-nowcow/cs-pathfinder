import { z } from 'zod'
import type { LibraryState } from './storage'

export const MAX_LIBRARY_BYTES = 3_000_000
export const MAX_LIBRARY_REVISION = 2_147_483_646
const stamp = z
  .string()
  .max(40)
  .refine((v) => Number.isFinite(Date.parse(v)))
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const date = new Date(v + 'T00:00:00Z')
    return (
      Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v
    )
  })
const entry = z
  .object({
    title: z.string().max(180),
    href: z
      .string()
      .regex(/^\/learn\/(?:engineer|jira)(?:[\/#?][a-zA-Z0-9_/?=#%-]*)?$/),
    track: z.enum(['engineer', 'jira']),
    visitedAt: stamp,
    updatedAt: stamp,
    draft: z.string().max(6000),
    checks: z.array(z.string().max(180)).max(30),
    status: z.enum(['learning', 'review', 'comfortable']),
    due: day.optional(),
  })
  .strict()
export const libraryAccountStateSchema: z.ZodType<LibraryState> = z
  .object({
    version: z.literal(1),
    entries: z
      .record(z.string().regex(/^(topic|mission|exam):[a-z0-9-]{1,80}$/), entry)
      .refine((v) => Object.keys(v).length <= 200),
  })
  .strict()
export const libraryWriteSchema = z
  .object({
    baseRevision: z
      .number()
      .int()
      .min(0)
      .max(MAX_LIBRARY_REVISION - 1),
    requestId: z.string().uuid(),
    state: libraryAccountStateSchema,
  })
  .strict()
export type LibraryWrite = z.infer<typeof libraryWriteSchema>
export type LibrarySnapshot = { revision: number; state: LibraryState }

// Stable across object-key order; array order remains meaningful.
export function canonicalLibraryJson(value: unknown): string {
  if (Array.isArray(value))
    return '[' + value.map(canonicalLibraryJson).join(',') + ']'
  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(
          (key) =>
            JSON.stringify(key) +
            ':' +
            canonicalLibraryJson((value as Record<string, unknown>)[key]),
        )
        .join(',') +
      '}'
    )
  }
  return JSON.stringify(value)
}
