import Link from 'next/link'
import { DeskAppearance } from './DeskAppearance'
import { TypographyPreferences } from './TypographyPreferences'
import { ReadingPreferences } from './ReadingPreferences'

export function StudyDesk({
  children,
  section = 'progress',
  document = false,
  reading = false,
}: {
  children: React.ReactNode
  section?: 'home' | 'library' | 'progress' | 'engineer' | 'jira' | 'pmp' | 'certificate'
  document?: boolean
  reading?: boolean
}) {
  const name = {
    home: '메인',
    library: '내 서재',
    progress: '복습·기록',
    engineer: '정보관리기술사',
    jira: 'Jira 연습',
    pmp: '프로젝트·제품 관리',
    certificate: '정보처리기사 이론',
  }[section]
  return (
    <div
      className={'study-library study-desk' + (reading ? ' desk-reading' : '') + (section === 'home' ? ' desk-home' : '')}
      data-appearance="light"
      data-typography="presentation"
    >
      <header className="desk-header">
        <Link href="/learn" className="desk-brand">
          <span className="desk-brand-mark" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1Z" />
              <path d="M12 6.5v14M6 9l3 .5m-3 3 3 .5m6-4 3-.5m-3 4 3-.5" />
            </svg>
          </span>
          CS 길라잡이
        </Link>
        <nav aria-label="주요 메뉴" className="flex items-center gap-6">
          <Link href="/learn" aria-current={section === 'home' ? 'page' : undefined} className="text-sm text-muted">
            메인
          </Link>
          <Link href="/learn/library" prefetch={false} aria-current={section === 'library' ? 'page' : undefined} className="text-sm text-muted">
            내 서재
          </Link>
          <DeskAppearance />
        </nav>
      </header>
      <div className="desk-layout">
        {section !== 'home' && <aside className="desk-sidebar">
          <nav aria-label="내 공부 메뉴">
            <Link href="/learn">메인</Link>
            <Link
              href="/learn/library"
              aria-current={section === 'library' ? 'page' : undefined}
              className={section === 'library' ? 'desk-current' : ''}
            >
              내 서재
            </Link>
            <Link
              href="/learn/progress"
              aria-current={section === 'progress' ? 'page' : undefined}
              className={section === 'progress' ? 'desk-current' : ''}
            >
              복습·기록
            </Link>
            <span className="desk-nav-label">PM 이론</span>
            <Link
              href="/learn/pmp"
              aria-current={section === 'pmp' ? 'page' : undefined}
            >
              프로젝트·제품 관리
            </Link>
            <Link
              href="/learn/jira"
              aria-current={section === 'jira' ? 'page' : undefined}
            >
              Jira 연습
            </Link>
            <span className="desk-nav-label">CS 이론</span>
            <Link href="/questions">CS 질문·해설</Link>
            <span className="desk-nav-label">자격증 대비</span>
            <Link
              href="/learn/engineer"
              aria-current={section === 'engineer' ? 'page' : undefined}
            >
              정보관리기술사
            </Link>
            <Link
              href="/learn/certificate"
              aria-current={section === 'certificate' ? 'page' : undefined}
            >
              정보처리기사 이론
            </Link>
            <Link href="/learn/engineer#questions" className="desk-sub-link">
              기출 찾아보기
            </Link>
          </nav>
        </aside>}
        <main className="desk-main">
          <div className="desk-pagebar">
            {document ? (
              <span className="desk-page-label">{name}</span>
            ) : (
              <h1>{name}</h1>
            )}
            <details className="desk-type-menu">
              <summary>읽기 설정</summary>
              <div>
                <TypographyPreferences />
                <ReadingPreferences />
              </div>
            </details>
          </div>
          <div className="study-content desk-content">{children}</div>
          <footer className="desk-footer">
            <p>{section === 'home' ? '읽던 자료와 학습 기록은 내 서재에서 이어볼 수 있습니다.' : '현재 브라우저에 저장된 학습 기록입니다.'}</p>
            <div className="flex gap-5">
              <Link href="/privacy">개인정보처리방침</Link>
              <Link href="/terms">이용약관</Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
