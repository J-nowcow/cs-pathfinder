import type { JourneyState } from '@/lib/journey/types'

/** Shared read/merge response contract; excludes account and database metadata. */
export type WireJourney = {
  occurrences: {
    id: string
    node_id: string
    parent_id: string | null
    question: string
    category: string
  }[]
  current_id: string | null
}

export function journeyToWire(snapshot: JourneyState): WireJourney {
  return {
    occurrences: snapshot.occurrences.map((row) => ({
      id: row.id,
      node_id: row.nodeId,
      parent_id: row.parentId,
      question: row.question,
      category: row.category,
    })),
    current_id: snapshot.currentId,
  }
}

/** Both success and error responses remain private and uncacheable. */
export function journeyResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'private, no-store',
    },
  })
}
