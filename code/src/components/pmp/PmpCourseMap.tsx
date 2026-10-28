import { pmpCourse } from '@/lib/pmp/course'

export const pmpMapGroups = [
  {
    title: '기본 체계',
    detail: '목적·권한·생애주기',
    chapters: ['foundation'],
  },
  {
    title: '계획과 통합',
    detail: '범위·일정·원가·변경',
    chapters: ['integration', 'scope', 'schedule', 'finance'],
  },
  {
    title: '실행과 품질',
    detail: '개발 접근법·흐름·검증',
    chapters: ['quality', 'agilebase', 'agiledelivery'],
  },
  {
    title: '사람과 소통',
    detail: '팀·리더십·이해관계자',
    chapters: ['team', 'stakeholders'],
  },
  {
    title: '불확실성과 계약',
    detail: '리스크·이슈·조달',
    chapters: ['risk', 'procurement'],
  },
  {
    title: '가치와 책임',
    detail: '편익·변화·윤리·전환',
    chapters: ['value', 'responsibility'],
  },
]

/** Server-rendered course orientation, with the same anchors as the chapter list. */
export function PmpCourseMap() {
  return (
    <section className="pmp-course-map" aria-labelledby="pmp-map-heading">
      <p className="lesson-eyebrow">전체 지도 · 14장·74수업</p>
      <h2 id="pmp-map-heading">프로젝트 관리 학습 지도</h2>
      <p>
        기본 체계를 익힌 뒤 계획·실행·가치를 연결합니다. 사람과 소통, 리스크와
        계약은 그 과정 전반에서 함께 다룹니다. 아래 분야를 고르면 해당 장의 수업
        목차로 이동합니다.
      </p>
      <svg
        viewBox="0 0 840 290"
        role="img"
        aria-labelledby="pmp-map-title pmp-map-desc"
      >
        <title id="pmp-map-title">프로젝트 관리 개념의 관계</title>
        <desc id="pmp-map-desc">
          기본 체계에서 계획과 통합, 실행과 품질, 가치와 책임으로 연결됩니다.
          실행 결과를 계획에 반영하며 사람과 소통, 불확실성과 계약이 전 과정을
          뒷받침합니다. 실제 프로젝트의 고정된 단계나 공식 프로세스 순서가 아닌
          학습 안내입니다.
        </desc>
        <defs>
          <marker
            id="pmp-map-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0 0L6 3L0 6" fill="none" stroke="currentColor" />
          </marker>
        </defs>
        <g className="course-map-lines" markerEnd="url(#pmp-map-arrow)">
          <path d="M190 78H220M395 78H425M600 78H630" />
          <path d="M514 116V149H307V119" />
        </g>
        <text x="410" y="172" textAnchor="middle" className="map-feedback">
          실행 결과에 따른 계획 조정
        </text>
        {[
          [15, '기본 체계', '목적·권한·생애주기'],
          [220, '계획과 통합', '범위·일정·원가·변경'],
          [425, '실행과 품질', '흐름·개발·검증'],
          [630, '가치와 책임', '편익·변화·전환'],
        ].map(([x, title, detail]) => (
          <g
            key={title}
            transform={'translate(' + x + ',34)'}
            className="map-card"
          >
            <rect width="175" height="82" rx="12" />
            <text x="87.5" y="34" textAnchor="middle" className="map-title">
              {title}
            </text>
            <text x="87.5" y="59" textAnchor="middle" className="map-detail">
              {detail}
            </text>
          </g>
        ))}
        <g className="map-foundation">
          <rect x="15" y="204" width="790" height="62" rx="12" />
          <text x="410" y="231" textAnchor="middle" className="map-title">
            사람과 소통 / 불확실성과 계약
          </text>
          <text x="410" y="253" textAnchor="middle" className="map-detail">
            팀·이해관계자·리스크·이슈·조달을 전 과정에서 함께 고려
          </text>
        </g>
      </svg>
      <p className="study-meta">
        학습을 위한 개념 지도입니다. 실제 프로젝트의 고정된 단계나 PMI 공식
        프로세스 순서를 나타내지 않습니다.
      </p>
      <div className="pmp-map-links">
        {pmpMapGroups.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <p>{group.detail}</p>
            <ul>
              {group.chapters.map((id) => (
                <li key={id}>
                  <a href={'#' + id}>
                    {pmpCourse.tracks.find((t) => t.id === id)!.title} ↓
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}
