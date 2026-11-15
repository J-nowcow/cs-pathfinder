import { StudyLessonContent } from '@/components/study-poc/StudyLessonContent'
import { learningMetadata, learningJsonLd } from '@/lib/seo/learning'
import { serializeJsonLd } from '@/lib/seo/jsonld'
import '@/app/study-poc/study-poc.css'

export const dynamic = 'force-static'
export const metadata = learningMetadata('/learn/db-connections')

export default function DbConnectionsPage() {
  const json = learningJsonLd('/learn/db-connections')
  return <>
    {json && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(json) }} />}
    <StudyLessonContent publicLesson />
  </>
}
