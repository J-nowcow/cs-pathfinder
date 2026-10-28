'use client'

import { useEffect } from 'react'
import { authClient } from '@/lib/auth/client'
import { startSyncForUser } from '@/lib/journey/sync'

/** One owner-bound job in the site layout; dispose on logout/change/unmount. */
export function SyncAgent() {
  const { data: session } = authClient.useSession()
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    const job = startSyncForUser(userId)
    return job.cancel
  }, [userId])

  return null
}
