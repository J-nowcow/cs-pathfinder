import Link from 'next/link'
import { certificateLessons, certificateHref } from '@/lib/certificate/course'
import {
  certificateSyllabus as s,
  certificateCriteriaPeriod,
} from '@/lib/certificate/syllabus'

export function CertificateSyllabus() {
  return (
    <section
      className="certificate-syllabus"
      aria-labelledby="certificate-syllabus-title"
    >
      <h2 id="certificate-syllabus-title">
        {certificateCriteriaPeriod.years} 출제기준 목차
      </h2>
      <p>
        시험 적용기간: {certificateCriteriaPeriod.dates}. 응시 예정일에 맞는
        출제기준인지{' '}
        <a href={s.source.url} target="_blank" rel="noopener noreferrer">
          큐넷 원문에서 확인하세요 ↗
        </a>
      </p>
      <p>{s.coverageNotice}</p>
      <p className="study-meta">
        필기 {s.written.subjects.length}과목 · {s.written.questions}문항 ·{' '}
        {s.written.minutes}분 / 실기 {s.practical.title} · {s.practical.format} ·{' '}
        {s.practical.minutes}분
      </p>
      <nav
        aria-label="정보처리기사 필기 과목"
        className="syllabus-subject-links"
      >
        {s.written.subjects.map((subject, i) => (
          <a key={subject.id} href={'#certificate-' + subject.id}>
            {i + 1}. {subject.title}
          </a>
        ))}
      </nav>
      {s.written.subjects.map((subject, i) => (
        <section
          key={subject.id}
          id={'certificate-' + subject.id}
          className="syllabus-subject"
        >
          <p className="study-meta">
            필기 {i + 1}과목 · {subject.questions}문항
          </p>
          <h3>{subject.title}</h3>
          <ol>
            {subject.units.map((unit) => (
              <li key={unit.id} id={'certificate-unit-' + unit.id}>
                <h4>{unit.title}</h4>
                <p>{unit.topics}</p>
                {unit.lessons.length ? (
                  <>
                    <p className="study-meta">
                      읽을 수 있는 기초 개념 · 단원 일부
                    </p>
                    <ul>
                      {unit.lessons.map((id) => (
                        <li key={id}>
                          <Link href={certificateHref(id)}>
                            {certificateLessons.get(id)!.title} →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="syllabus-pending">목차 정리 · 본문 미작성</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      <details className="desk-utility">
        <summary>
          실기 {s.practical.title} · {s.practical.units.length}개 주요항목
        </summary>
        <ol className="syllabus-practical">
          {s.practical.units.map((unit) => (
            <li key={unit.id}>
              <h3>{unit.title}</h3>
              <p>{unit.topics}</p>
              {unit.lessons.length ? (
                <ul>
                  {unit.lessons.map((id) => (
                    <li key={id}>
                      <Link href={certificateHref(id)}>
                        {certificateLessons.get(id)!.title} →
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="syllabus-pending">목차 정리 · 본문 미작성</p>
              )}
            </li>
          ))}
        </ol>
      </details>
      <p className="study-meta">{s.mappingNotice}</p>
      <p className="study-meta">
        <a href={s.source.url} target="_blank" rel="noopener noreferrer">
          큐넷 공식 출제기준 ↗
        </a>{' '}
        · 적용 {certificateCriteriaPeriod.dates} · 확인 {s.source.checked}
      </p>
    </section>
  )
}
