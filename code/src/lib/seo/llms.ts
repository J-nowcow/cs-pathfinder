import type { Catalog } from '@/lib/db/catalog'

/**
 * AI 에이전트에게 주는 안내판(llms.txt).
 *
 * robots·sitemap이 사람용 검색 크롤러의 표지판이라면 이쪽은 LLM용이다 —
 * 루트의 `/llms.txt`에 "이 사이트의 핵심은 여기"를 마크다운으로 적는
 * 제안 표준(Answer.AI, 2024)이다. 채택은 논쟁 중이지만 비용이 사실상
 * 0이고, 이 서비스는 콘텐츠가 애초에 마크다운이라 자동 생성 한 층이면
 * 끝난다.
 *
 * 담는 것은 `loadCatalog`가 고른 것 그대로다 — 공개해도 되는 것의 판단
 * (`origin='batch'`·미래 발행 제외)을 여기서 다시 하지 않는다. 목록이
 * 갈리면 sitemap과 llms.txt가 서로 다른 사이트를 말하게 된다.
 */

export function renderLlms(catalog: Catalog, base: string): string {
  const lines: string[] = [
    '# CS 길라잡이',
    '',
    '> 하루에 질문 하나씩 올라오는 한국어 CS 기술면접 학습 서비스. 해설은 "첫 문장이 곧 답" 구조이고, 해설마다 꼬리질문 5개로 더 깊이 팔 수 있다. 질문은 그래프로 이어져 있다.',
    '',
    `- 질문 수: ${catalog.entries.length} (매일 아침 6시 KST 1개 추가)`,
    `- 전체 해설 전문(마크다운 한 파일): ${base}/llms-full.txt`,
    `- 질문 목록 화면: ${base}/questions`,
    `- 용어 사전(75개, 한/영 병기): ${base}/glossary`,
    '- 저장소(해설 원문 마크다운 포함): https://github.com/J-nowcow/cs-pathfinder',
    '',
  ]

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
    `> 한국어 CS 기술면접 질문 ${catalog.entries.length}개의 해설 전문. 본문의 ':::이름 … :::' 블록은 도식(flow=순서, state=상태, stack=계층, tree=트리, timeline=시간축, note/warn=콜아웃) 문법이고, ==글==은 강조다.`,
    '',
  ]

  for (const group of catalog.byCategory) {
    lines.push(`# ${group.category}`, '')
    for (const e of group.entries) {
      lines.push(`## ${e.question}`, '', `원문: ${base}/q/${e.id}`, '', e.body ?? '', '')
    }
  }

  return lines.join('\n')
}
