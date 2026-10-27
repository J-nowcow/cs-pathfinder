import Link from 'next/link'
import release from '../../data/pmp-release.json'

/**
 * 분야를 늘리기 위한 첫 입구다. 검토한 PMP 릴리스를 같은 앱에서 열 수 있게 한다.
 * PMP는 아직 별도 학습 엔진이므로 CS 계정 기록과 합쳐졌다고 표시하지 않는다.
 * 정적 HTML에는 일반 a를 써서 Next의 클라이언트 라우팅을 거치지 않고 연다.
 */
export function LearningAreas() {
  const button = 'inline-flex min-h-11 items-center rounded-lg border border-line px-4 py-2 text-[14px] font-medium text-accent hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

  return (
    <div className="mt-8 grid min-w-0 gap-5">
      <Link className="rounded-xl border border-line bg-raised p-5 text-sm font-medium text-accent" href="/learn/progress">모든 학습 기록 · 이어보기와 오늘 복습 모아보기 →</Link>
      <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="cs-area">
        <p className="text-[11px] font-medium tracking-[0.12em] text-faint">COMPUTER SCIENCE</p>
        <h2 id="cs-area" className="mt-3 text-[22px] font-bold">컴퓨터과학</h2>
        <p className="mt-3 text-[15px] leading-7 text-muted">질문에 먼저 답하고, 부족한 개념을 꼬리질문과 지도로 이어서 공부합니다.</p>
        <Link className={`${button} mt-5`} href="/questions">CS 질문 살펴보기 →</Link>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="pm-area">
        <p className="text-[11px] font-medium tracking-[0.12em] text-faint">PROJECT · PRODUCT · AI</p>
        <h2 id="pm-area" className="mt-3 text-[22px] font-bold">프로젝트·제품 관리</h2>
        <p className="mt-3 text-[15px] leading-7 text-muted">PMP의 기본 개념에서 제품 발견·실험·사업 가치·AI 검증까지, 사례와 계산으로 판단을 연습합니다.</p>
        <p className="mt-4 text-[13px] leading-6 text-faint">{release.stats.chapters}장 · {release.stats.lessons}수업 · {release.stats.questions}개 창작 판단 문제 · {release.stats.terms}개 용어</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a className={button} href={release.links.study}>PMP 통합 자습서 열기 →</a>
          <a className={button} href={release.links.reader}>전체 읽기 열기 →</a>
          <a className={button} href={release.links.offline} download>오프라인 ZIP 받기 ↓</a>
        </div>
        <p className="mt-5 text-[12px] leading-6 text-faint">검토한 자료 v{release.version} · {release.asof}. 독립 자습서이며 공식 교재·기출·공인 교육시간 과정이 아닙니다.</p>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="jira-area">
        <p className="text-[11px] font-medium tracking-[0.12em] text-faint">TOOLS · PRACTICE</p>
        <h2 id="jira-area" className="mt-3 text-[22px] font-bold">Jira 실무</h2>
        <p className="mt-3 text-[15px] leading-7 text-muted">요구를 작업으로 나누고, 흐름·검색·변경·보고를 가상 표본에서 연습합니다. PMP 개념을 실제로 남길 기록과 연결합니다.</p>
        <p className="mt-4 text-[13px] text-faint">10수업 · 20 JQL · 16가상 작업 · 5실무 미션</p>
        <Link className={`${button} mt-5`} href="/learn/jira">Jira 실무 미션 열기 →</Link>
      </section>
      <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8" aria-labelledby="engineer-area">
        <p className="text-[11px] font-medium tracking-[0.12em] text-faint">INFORMATION MANAGEMENT · CONNECT & WRITE</p>
        <h2 id="engineer-area" className="mt-3 text-[22px] font-bold">정보관리기술사</h2>
        <p className="mt-3 text-[15px] leading-7 text-muted">기출을 개념과 질문 유형으로 연결하고, 개념도·비교표·답안 골격을 읽은 뒤 내 답을 씁니다. 실제 기출 색인과 창작 참고 답안을 구분해 제공합니다.</p>
        <p className="mt-4 text-[13px] text-faint">24핵심 주제 · 60회차의 1,860기출 위치 · 원문 제공 31문항</p>
        <Link className={`${button} mt-5`} href="/learn/engineer">주제와 기출 연결하기 →</Link>
      </section>
      <aside className="rounded-xl border border-dashed border-line p-5 text-[13px] leading-7 text-muted">
        PMP 진도·메모는 현재 브라우저에 저장되며 CS 계정 기록과 별도로 관리됩니다. PMP의 ‘내 기록’에서 백업을 내보내고 불러올 수 있습니다. 내려받은 파일은 자동 갱신되지 않으니 자료 버전을 확인해 주세요.
      </aside>
    </div>
  )
}
