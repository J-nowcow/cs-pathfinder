import type { Catalog } from '@/lib/db/catalog'
import { renderLearningLinks } from './learning'
import { CASE_ID, source, translations } from '@/lib/cases/content'

/** Public source directory for retrieval clients; not a ranking or indexing protocol. */
function renderCaseLinks(base: string): string[] {
  const lesson = new URL(`/learn/cases/${CASE_ID}`, base).href
  return [
    '## 공개 사례 학습',
    '',
    `- [사례 목록](${new URL('/learn/cases', base).href})`,
    `- [${translations.ko.title}](${lesson}): ${translations.ko.scope}`,
    `- [${source.title}](${source.url}): 원자료 발행일 ${source.published}, 학습 자료의 출처 확인일 ${source.checked}.`,
    '- 사례 수업은 공개 HTML에서 읽습니다. 개인 답안·학습 진도·백업 파일은 이 안내에 포함하지 않습니다.',
    '',
  ]
}

export function renderLlms(catalog: Catalog, base: string): string {
  const lines: string[] = [
    '# CS 길라잡이',
    '',
    '> 한국어 CS 기술면접 해설과 PM 이론·자격증 대비 학습 서재. CS 해설은 "첫 문장이 곧 답" 구조이고 해설마다 꼬리질문 5개로 더 깊이 팔 수 있다. 질문은 그래프로 이어져 있다. PMP·기술사·정보처리기사·Jira 수업은 아래의 정식 HTML 주소에서 읽을 수 있다.',
    '',
    `- 공개 CS 질문 수: ${catalog.entries.length} (목록 기준일: ${catalog.date}, Asia/Seoul)`,
    `- 전체 해설 전문(마크다운 한 파일): ${base}/llms-full.txt`,
    `- 질문 목록 화면: ${base}/questions`,
    `- 용어 사전(75개, 한/영 병기): ${base}/glossary`,
    '- 저장소(해설 원문 마크다운 포함): https://github.com/J-nowcow/cs-pathfinder',
    '',
  ]

  lines.push(...renderLearningLinks(base), ...renderCaseLinks(base))
  for (const group of catalog.byCategory) {
    lines.push(`## ${group.category}`, '')
    for (const e of group.entries) {
      lines.push(`- [${e.question}](${base}/q/${e.id})`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * 해설 전문판(llms-full.txt).
 *
 * `:::flow` 같은 펜스는 이 서비스의 도식 문법이다. 걷어내면 정보가
 * 사라지므로 그대로 두고, 문법의 뜻을 머리말에 한 줄로 알린다 — 읽는
 * 쪽이 LLM이라 설명 한 줄이면 충분하다.
 */
export function renderLlmsFull(catalog: Catalog, base: string): string {
  const lines: string[] = [
    '# CS 길라잡이 — 해설 전문',
    '',
    `> 한국어 CS 기술면접 질문 ${catalog.entries.length}개의 해설 전문과 PM·자격증 수업 안내. PM·자격증 수업의 전문은 연결된 HTML 주소에서 읽는다. 본문의 ':::이름 … :::' 블록은 도식(flow=순서, state=상태, stack=계층, tree=트리, timeline=시간축, note/warn=콜아웃) 문법이고 ==글==은 강조다.`,
    '',
  ]

  // Native lessons stay at their canonical HTML URLs; this is not their full transcript.
  lines.push(...renderLearningLinks(base), ...renderCaseLinks(base))
  for (const group of catalog.byCategory) {
    lines.push(`# ${group.category}`, '')
    for (const e of group.entries) {
      lines.push(`## ${e.question}`, '', `원문: ${base}/q/${e.id}`, '', e.body ?? '', '')
    }
  }

  return lines.join('\n')
}
