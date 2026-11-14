export function LessonSectionHeading({
  id,
  children,
  className = '',
}: {
  id: string
  children: string
  className?: string
}) {
  return (
    <h2 id={id} tabIndex={-1} className={`scroll-mt-8 ${className}`}>
      {children}
      <a
        href={`#${id}`}
        aria-label={`${children} 바로가기`}
        className="ml-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded text-sm font-normal text-faint no-underline hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden="true">#</span>
      </a>
    </h2>
  )
}
