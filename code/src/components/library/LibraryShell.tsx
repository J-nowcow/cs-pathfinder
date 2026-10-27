import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SiteFooter } from '@/components/SiteFooter'
export const libraryButton =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-medium text-accent hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
export function LibraryShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <>
      <header className="border-b border-line">
        <nav
          aria-label="학습 도서관"
          className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-5 py-3"
        >
          <Link
            className="mr-auto min-h-11 content-center font-semibold"
            href="/learn"
          >
            ← 학습 분야
          </Link>
          <Link className="text-sm text-accent" href="/learn/progress">
            모든 학습 기록
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
        <p className="text-xs tracking-widest text-faint">{eyebrow}</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-muted">
          {description}
        </p>
        <div className="mt-10 space-y-10">{children}</div>
      </main>
      <SiteFooter />
    </>
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
