import { StudyDesk } from './StudyDesk'
export const libraryButton =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-medium text-accent hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
export function LibraryShell({
  eyebrow,
  title,
  description,
  children,
  reading = false,
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
  reading?: boolean
}) {
  return (
    <StudyDesk
      section={
        eyebrow.includes('정보처리기사')
          ? 'certificate'
          : eyebrow.includes('정보관리기술사')
            ? 'engineer'
            : eyebrow.includes('PMP')
              ? 'pmp'
              : 'jira'
      }
      document
      reading={reading}
    >
      <header className="desk-document-heading">
        <p className="study-meta">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="space-y-12">{children}</div>
    </StudyDesk>
  )
}

export function ConceptFlow({ items }: { items: string[] }) {
  return (
    <ol
      aria-label="개념의 연결"
      className="grid list-none gap-3 p-0 sm:grid-cols-4"
    >
      {items.map((x, i) => (
        <li key={x} className="rounded-xl border border-line bg-raised p-4">
          <span className="text-xs text-faint">
            {String(i + 1).padStart(2, '0')} {i < items.length - 1 ? '→' : ''}
          </span>
          <p className="mt-2 font-medium">{x}</p>
        </li>
      ))}
    </ol>
  )
}
