import Link from 'next/link'
import { learningBreadcrumbs, learningJsonLd } from '@/lib/seo/learning'
import { serializeJsonLd } from '@/lib/seo/jsonld'

export function LearningSeo({ path }: { path: string }) {
  const json = learningJsonLd(path), chain = learningBreadcrumbs(path)
  if (!json) return null
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(json) }} />
    {chain.length > 1 && <nav aria-label="학습 경로" className="study-meta mb-6">
      <ol className="flex flex-wrap gap-2">
        {chain.map((page, i) => <li key={page.path}>
          {i > 0 && <span aria-hidden="true" className="mr-2">/</span>}
          {i === chain.length - 1 ? <span aria-current="page">{page.title}</span>
            : <Link href={page.path} prefetch={false}>{page.title}</Link>}
        </li>)}
      </ol>
    </nav>}
  </>
}
