'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { DeskAppearance } from './DeskAppearance'

export const studyNavigationGroups = [
  { label: '사례 연습', sections: ['cases'], links: [
    { href: '/learn/cases', label: '사례로 판단 연습', detail: '개발자·프로젝트 PM·제품 PM의 근거 비교' },
  ] },
  { label: 'PM 이론', sections: ['pmp', 'jira'], links: [
    { href: '/learn/pmp', label: '프로젝트·제품 관리', detail: 'PMP 개념·사례·계산 실습' },
    { href: '/learn/jira', label: 'Jira 연습', detail: '작업 흐름·JQL·변경 기록' },
    { href: '/learn/pmp/terms', label: 'PMP 용어 사전' },
    { href: '/learn/pmp/search', label: 'PMP 수업 검색' },
  ] },
  { label: 'CS 이론', sections: [], links: [
    { href: '/questions', label: 'CS 질문·해설' },
    { href: '/map', label: '개념 지도' },
    { href: '/glossary', label: 'CS 용어 사전' },
    { href: '/cs', label: '오늘의 CS 질문' },
    { href: '/me', label: 'CS 학습 기록' },
  ] },
  { label: '자격증 대비', sections: ['engineer', 'certificate'], links: [
    { href: '/learn/engineer', label: '정보관리기술사', detail: '연결 개념·답안 연습' },
    { href: '/learn/engineer#questions', label: '기술사 기출 찾아보기' },
    { href: '/learn/certificate', label: '정보처리기사 이론', detail: '2027–2029 출제기준·기초 이론' },
  ] },
]

export function StudyNavigation({ section }: { section: string }) {
  const root = useRef<HTMLElement>(null)
  const pathname = usePathname()
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node))
        root.current?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(menu => { menu.open = false })
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  useEffect(() => {
    root.current?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach(menu => { menu.open = false })
  }, [pathname])
  return (
    <nav ref={root} aria-label="주요 메뉴" className="desk-topnav" onKeyDown={event => {
      if (event.key !== 'Escape') return
      const menu = (event.target as HTMLElement).closest<HTMLDetailsElement>('details[open]')
      if (menu && root.current?.contains(menu)) {
        menu.open = false
        menu.querySelector('summary')?.focus()
        event.preventDefault()
      }
    }}>
      <Link href="/" prefetch={false} aria-current={pathname === '/' ? 'page' : undefined}>메인</Link>
      {studyNavigationGroups.map(group => (
        <details key={group.label} name="desk-study-navigation" className="desk-nav-group" data-active={group.sections.includes(section)}>
          <summary>{group.label}<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></summary>
          <div className="desk-nav-panel">
            {group.links.map(link => (
              <Link key={link.href} href={link.href} prefetch={false} aria-current={pathname === link.href ? 'page' : undefined}>
                <span>{link.label}</span>
                {'detail' in link && <small>{link.detail}</small>}
              </Link>
            ))}
          </div>
        </details>
      ))}
      <Link href="/learn/library" prefetch={false} aria-current={pathname === '/learn/library' ? 'page' : undefined}>내 서재</Link>
      <Link href="/learn/progress" prefetch={false} aria-current={pathname === '/learn/progress' ? 'page' : undefined}>복습·기록</Link>
      <DeskAppearance />
    </nav>
  )
}
