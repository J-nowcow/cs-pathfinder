import {
  certificateCriteriaPeriod,
  certificateSyllabus,
} from '@/lib/certificate/syllabus'

export function CertificateCriteriaNotice() {
  return (
    <p className="study-meta">
      이 수업의 과목·단원은 {certificateCriteriaPeriod.dates} 출제기준
      목차에 따라 표시했습니다. 응시 예정일에 맞는 기준인지{' '}
      <a
        href={certificateSyllabus.source.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        큐넷 원문에서 확인하세요 ↗
      </a>
    </p>
  )
}
