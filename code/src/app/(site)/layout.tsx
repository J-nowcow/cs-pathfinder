import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { SyncAgent } from '@/components/SyncAgent'

/**
 * 읽는 화면의 공통 틀.
 *
 * 홈·질문·목록·트리가 여기 든다. 지도(`/map`)는 안 든다 — 전체 화면을 쓰고
 * 자기 헤더가 이미 있어서, 공통 헤더를 붙이면 위가 두 겹이 되고 지도 높이도
 * 그만큼 줄어든다.
 *
 * 라우트 그룹이라 주소는 그대로다. `(site)`는 URL에 안 나타난다.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 로그인한 사람의 기록을 계정과 합친다. 아무것도 안 그린다 (C4) */}
      <SyncAgent />
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  )
}
