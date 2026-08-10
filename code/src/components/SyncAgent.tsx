'use client'

import { useEffect } from 'react'
import { authClient } from '@/lib/auth/client'
import { syncForUser } from '@/lib/journey/sync'

/**
 * 로그인한 사람의 기록을 계정과 합치는 보이지 않는 손 (C4).
 *
 * (site) 레이아웃에 하나만 산다 — /q도 /me도 이 한 곳으로 덮인다.
 * OAuth 콜백 복귀는 전체 페이지 이동이라 여기가 새로 마운트되고,
 * sessionStorage 마커와 userId가 어긋나 있어 자동으로 동기화가 돈다.
 *
 * 아무것도 그리지 않는다. 실패해도 아무 일도 없다 — sync가 절대
 * 던지지 않고, 실패 시 로컬을 건드리지 않는다.
 */
export function SyncAgent() {
  const { data: session } = authClient.useSession()
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    void syncForUser(userId)
  }, [userId])

  return null
}
