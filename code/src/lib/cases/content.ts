export const CASE_ID = 'github-migration-2026'
export const CONTENT_VERSION = 1
export const source = {
  id: 'github-may-2026',
  title: 'GitHub availability report: May 2026',
  url: 'https://github.blog/news-insights/company-news/github-availability-report-may-2026/',
  published: '2026-06-11',
  checked: '2026-10-31',
}
export const roles = ['developer', 'project', 'product'] as const
export type Role = (typeof roles)[number]
export type Locale = 'ko' | 'en'
export type RoleContent = {
  name: string
  goal: string
  prompt: string
  example: string
  checks: [string, string, string]
  transferPrompt: string
  transferChecks: [string, string, string]
  recallPrompt: string
}
type Translation = {
  title: string
  lead: string
  scope: string
  facts: [string, string, string]
  outcome: string
  glossary: { term: string; meaning: string; href?: string }[]
  principles: string[]
  variation: string
  roles: Record<Role, RoleContent>
}

// Original educational prompts and examples. The source report is linked, not mirrored.
// IDs and check positions are shared by both translations; bump CONTENT_VERSION
// if a change makes an existing answer or self-assessment refer to a different task.
export const translations: Record<Locale, Translation> = {
  ko: {
    title: '잘 돌던 작업을 멈춰야 할 때',
    lead: '같은 장애를 개발자와 두 종류의 PM은 어떻게 판단할까요? 사실을 읽고 내 판단을 남기고 조건을 바꿔 다시 생각해 봅니다.',
    scope: 'GitHub의 사후 보고서를 바탕으로 만든 학습 과제입니다. 당시 대응 상황의 재현이 아니며 질문과 작성 예시는 교육용입니다.',
    facts: [
      'F1 · 2026년 5월 4일 GitHub의 여러 서비스에서 응답 지연과 요청 실패가 발생했습니다.',
      'F2 · 몇 시간 동안 진행되던 스키마 변경과 늘어난 사용자 요청이 겹쳐 데이터베이스 연결 용량이 포화됐습니다.',
      'F3 · 주 데이터베이스의 쿼리 경합과 이를 사용하는 서비스들의 연쇄 시간 초과가 보고됐습니다.',
    ],
    outcome: '보고서에 따르면 변경 작업을 일시 중지한 뒤 서비스들이 회복됐습니다. 후속 조치로 부하에 따른 작업 속도 조절, 자동 중단 장치, 연결 용량의 여유 확보를 제시했습니다.',
    glossary: [
      { term: '스키마 변경', meaning: '테이블의 열이나 자료형처럼 데이터 저장 구조를 바꾸는 작업입니다. 서비스 요청과 동시에 자원을 사용할 수 있습니다.' },
      { term: '연결 용량', meaning: '데이터베이스와 통신할 수 있는 연결의 한도입니다. 웹 요청이 적어도 내부 작업이 연결을 많이 쓰면 여유가 줄 수 있습니다.' },
      { term: '쿼리 경합', meaning: '여러 데이터 처리 요청이 한정된 자원을 놓고 경쟁하는 상황입니다. 이 사례를 특정 교착 상태로 단정할 정보는 없습니다.', href: '/learn/engineer/concurrency' },
    ],
    principles: [
      '하나의 지표만으로 원인을 확정하지 말고 자원을 쓰는 작업과 사용자 증상을 연결해 봅니다.',
      '작업을 끝내는 기준과 서비스를 회복했다고 판단하는 기준을 따로 적습니다.',
      '중단·속도 조절 뒤 어떤 관측이 달라져야 하는지 먼저 정합니다. 정확한 수치는 해당 시스템의 기준을 확인해야 합니다.',
    ],
    variation: '교육용 가정 · 다른 서비스에서 사용자 요청은 평소보다 적지만 누락된 데이터를 다시 처리하는 내부 작업이 늘었습니다. DB 연결 사용률과 요청 지연이 함께 상승했고 아직 오류는 없습니다. 실제 GitHub에서 일어난 후속 사건이 아닙니다.',
    roles: {
      developer: {
        name: '개발자',
        goal: '관측된 현상과 가설을 구분하고 조치 뒤 확인할 지표를 설명합니다.',
        prompt: 'F1–F3 중 어떤 근거를 연결해 원인 가설을 세우겠습니까? 먼저 확인할 항목, 취할 조치, 조치 뒤 달라져야 할 관측을 적어 보세요.',
        example: 'F2와 F3를 연결하면 변경 작업과 사용자 요청의 합산 부하가 연결 여유를 줄였다는 가설을 세울 수 있습니다. 작업별 연결 사용과 대기·지연 추이를 확인하겠습니다. 작업을 멈추거나 줄인 뒤 연결 여유와 사용자 요청 지연이 회복되는지 보겠습니다. 회복하지 않으면 다른 경합 원인을 더 살피겠습니다. 변경 작업이 있었다는 사실만으로 특정 쿼리나 교착 상태를 확정할 수는 없습니다.',
        checks: ['사실 ID와 원인 가설을 연결했나요?', '원인 확인에 필요한 관측을 적었나요?', '조치 뒤 기대하는 변화와 가설이 틀릴 가능성을 적었나요?'],
        transferPrompt: '웹 요청이 적다는 이유만으로 안전하다고 볼 수 있을까요? 원래 사례와 같은 원리, 달라진 조건, 조치와 확인할 관측을 적어 보세요.',
        transferChecks: ['사용자 요청과 내부 작업을 함께 고려했나요?', '오류 발생 전의 지연·연결 압력을 근거로 썼나요?', '조치의 효과를 확인할 관측을 적었나요?'],
        recallPrompt: '해설을 다시 읽기 전에 적어 보세요. 자원을 함께 쓰는 두 작업이 있을 때 원인 가설을 확인하는 방법과 가설을 수정할 관측은 무엇인가요?',
      },
      project: {
        name: '프로젝트 PM',
        goal: '변경 작업의 의존성과 중단·재개 조건을 설명합니다.',
        prompt: '이번 변경을 관리한다면 누구와 어떤 정보를 확인하겠습니까? F1–F3를 근거로 중단 판단, 결정 책임, 재개 전 확인할 조건을 적어 보세요.',
        example: 'F2의 변경 작업과 F3의 의존 서비스에 미치는 영향을 함께 확인하겠습니다. 기술 담당자와 연결 여유·지연·영향 범위를 살피고 중단을 결정할 담당자를 확인하겠습니다. 중단 후 사용자 서비스가 회복됐는지 확인한 뒤 여유 용량·작업 속도 제한·다시 멈출 조건을 협의하고 필요한 승인을 거쳐 재개를 제안하겠습니다. 일정 지연도 기록하되 작업 완료만으로 회복을 선언하지 않겠습니다.',
        checks: ['영향 받는 서비스와 확인할 담당자를 적었나요?', '중단 판단의 근거와 결정 책임을 적었나요?', '재개 조건에 회복 확인과 재중단 기준을 넣었나요?'],
        transferPrompt: '오류가 아직 없는 이 작업을 계속할지 어떻게 결정하겠습니까? 확인할 담당자, 필요한 근거, 중단·재개 조건을 적어 보세요.',
        transferChecks: ['오류가 없어도 확인할 위험 신호를 적었나요?', '기술 담당자와 의사결정 책임을 구분했나요?', '내부 작업을 줄이거나 재개할 조건을 적었나요?'],
        recallPrompt: '해설을 다시 읽기 전에 적어 보세요. 서비스에 영향을 주는 변경에서 중단 책임, 회복 확인, 재개 조건을 어떻게 연결하나요?',
      },
      product: {
        name: '제품 PM',
        goal: '기술 상태를 사용자 영향과 연결하고 서비스 회복 기준을 설명합니다.',
        prompt: 'F1–F3가 사용자에게 어떤 문제를 만들 수 있습니까? 먼저 확인할 사용자 과업, 우선 보호할 경험, 회복을 판단할 근거를 적어 보세요.',
        example: 'F1의 지연과 요청 실패가 어떤 사용자 과업을 막는지 먼저 확인하겠습니다. 이용량이 적어도 중요한 과업은 보호해야 하므로 실패율뿐 아니라 과업별 성공 여부와 지연을 기술 담당자에게 확인하겠습니다. 영향 범위에 따라 안내할 내용을 정하고 변경 작업 종료와 별개로 주요 과업의 성공·지연이 합의한 기준으로 돌아왔는지 보겠습니다. 사용자별 손실은 이 보고서만으로 확정하지 않겠습니다.',
        checks: ['기술 증상을 사용자 과업과 연결했나요?', '우선순위를 정하는 데 필요한 정보를 적었나요?', '사용자 관점의 회복 기준과 아직 모르는 점을 적었나요?'],
        transferPrompt: '사용자가 아직 오류를 겪지 않았다면 무엇을 먼저 보호하고 확인하겠습니까? 중요한 사용자 과업과 조치 후 확인할 지표를 적어 보세요.',
        transferChecks: ['오류 외에 사용자에게 중요한 지연·과업을 고려했나요?', '이용량과 과업의 중요도를 구분했나요?', '보호할 경험과 회복 판단 근거를 연결했나요?'],
        recallPrompt: '해설을 다시 읽기 전에 적어 보세요. 기술 작업의 완료와 사용자의 서비스 회복은 어떻게 다르며 무엇을 확인해야 하나요?',
      },
    },
  },
  en: {
    title: 'When a healthy operation needs to stop',
    lead: 'How would a developer, a project manager, and a product manager reason about the same incident? Read the evidence, record your judgment, then try a different set of conditions.',
    scope: 'A learning task based on GitHub’s retrospective report. This does not recreate the live response. Questions and worked examples are authored for education.',
    facts: [
      'F1 · On May 4, 2026, several GitHub services experienced increased latency and request failures.',
      'F2 · A schema migration had been running for hours. Its load combined with rising user traffic to saturate database connection capacity.',
      'F3 · The report describes query contention on a primary database and cascading timeouts in dependent services.',
    ],
    outcome: 'The report says services recovered after the migration was paused. It announced follow-up improvements including load-adaptive throttling, automatic circuit breakers, and connection-pool headroom.',
    glossary: [
      { term: 'Schema migration', meaning: 'A change to the structure used to store data, such as table columns or types. It may consume resources alongside service requests.' },
      { term: 'Connection capacity', meaning: 'The available connections for communicating with a database. Internal jobs can consume that capacity even when web traffic is low.' },
      { term: 'Query contention', meaning: 'Data requests competing for limited resources. This report does not establish a particular deadlock.', href: '/learn/engineer/concurrency' },
    ],
    principles: [
      'Connect the work consuming resources to user symptoms. A single metric does not establish a cause.',
      'Define operation completion and service recovery separately.',
      'Before pausing or slowing work, state what observations should change. Specific thresholds require the system’s own operating criteria.',
    ],
    variation: 'Authored scenario · In another service, user traffic is below normal but an internal job is reprocessing missing data. Database connection utilization and request latency are rising together; no errors have occurred yet. This is not a later event at GitHub.',
    roles: {
      developer: {
        name: 'Developer',
        goal: 'Separate observations from hypotheses and explain what to check after an intervention.',
        prompt: 'Which of F1–F3 support your causal hypothesis? Record what to inspect first, an intervention, and the observations you expect to change afterward.',
        example: 'F2 and F3 support a hypothesis that combined migration and user load reduced connection headroom. I would inspect connections by workload and trends in waits and latency. After pausing or slowing the operation, I would check whether headroom and user-request latency recover. If they do not, I would investigate other sources of contention. The presence of a migration alone does not identify a particular query or establish a deadlock.',
        checks: ['Did you connect fact IDs to a hypothesis?', 'Did you identify observations needed to investigate the cause?', 'Did you state an expected change and a way the hypothesis could be wrong?'],
        transferPrompt: 'Does low web traffic establish that this operation is safe? Explain the shared principle, the changed condition, an intervention, and what to observe.',
        transferChecks: ['Did you consider user traffic and internal work together?', 'Did you use latency and connection pressure before errors as evidence?', 'Did you identify observations that would test the intervention?'],
        recallPrompt: 'Before rereading: when two workloads share resources, how would you investigate a causal hypothesis? What observation would make you revise it?',
      },
      project: {
        name: 'Project manager',
        goal: 'Explain change dependencies and conditions for pausing and resuming work.',
        prompt: 'If managing this change, whom would you consult and what would you check? Use F1–F3 to explain a pause decision, decision ownership, and conditions for resuming.',
        example: 'I would consider the migration in F2 together with its impact on the dependent services in F3. With technical owners, I would inspect headroom, latency, and impact, and confirm who can pause the work. After a pause, I would verify user-service recovery, consult on headroom, rate limits, and stop conditions, and propose resuming through the required approval process. I would record schedule effects while treating operation completion and service recovery separately.',
        checks: ['Did you identify affected services and people to consult?', 'Did you explain evidence for pausing and decision ownership?', 'Did your resume conditions include recovery and another stop condition?'],
        transferPrompt: 'How would you decide whether to continue when no errors have occurred yet? State whom to consult, the evidence needed, and pause/resume conditions.',
        transferChecks: ['Did you identify risk signals before errors?', 'Did you distinguish technical consultation from decision ownership?', 'Did you state conditions for slowing or resuming internal work?'],
        recallPrompt: 'Before rereading: how do pause authority, recovery checks, and resume conditions connect when a change affects a service?',
      },
      product: {
        name: 'Product manager',
        goal: 'Connect technical state to user impact and explain service-recovery criteria.',
        prompt: 'What user problems could F1–F3 create? Identify user tasks to inspect first, the experience to protect, and evidence of recovery.',
        example: 'I would first identify which user tasks are affected by the latency and failures in F1. A low-volume task may still be important, so I would ask technical owners about task success and latency as well as error rates. I would decide what to communicate based on impact, then check whether key tasks meet agreed success and latency criteria independently of whether the migration finishes. This report alone cannot establish losses for each user.',
        checks: ['Did you connect technical symptoms to user tasks?', 'Did you identify information needed to set priorities?', 'Did you state user-facing recovery criteria and remaining uncertainty?'],
        transferPrompt: 'What would you protect and check first before users encounter errors? Identify important user tasks and observations to check after an intervention.',
        transferChecks: ['Did you consider latency and task outcomes as well as errors?', 'Did you distinguish traffic volume from task importance?', 'Did you connect the experience to protect with recovery evidence?'],
        recallPrompt: 'Before rereading: how does completing technical work differ from restoring service for users, and what should you check?',
      },
    },
  },
}
