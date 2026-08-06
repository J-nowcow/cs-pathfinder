import { describe, it, expect } from 'vitest'
import { contentIssues, blocking, complaint } from '@/lib/llm/content-rules'
import { EXAMPLE_NODES } from '../../data/example-nodes'

/**
 * 규칙 검사기.
 *
 * 이 검사기가 붙기 전까지 운영 경로는 "비었나"만 봤다. 프롬프트에 적힌
 * 규칙 전부가 강제되지 않았고, 검사하는 코드는 오프라인 배치 스크립트에만
 * 있었다.
 */
const ok = {
  body: '커넥션을 매번 새로 맺으면 TCP 핸드셰이크와 인증을 그때마다 다시 한다.\n\n:::flow\n앱 -> DB: 연결 요청\nDB -> 앱: 인증 후 수립\n:::\n\n풀은 맺어둔 것을 빌려준다. 비용이 요청당 한 번에서 프로세스당 한 번으로 줄어든다.',
  suggestions: [
    '풀 크기는 무엇을 보고 정하는가?',
    '유휴 커넥션은 왜 끊어야 하는가?',
    '풀이 고갈되면 무슨 일이 생기는가?',
    '프리페어드 스테이트먼트는 왜 풀과 엮이는가?',
    '서버리스에서 풀이 잘 안 듣는 이유는?',
  ],
}

describe('contentIssues · 통과', () => {
  it('규칙을 지킨 해설은 지적이 없다', () => {
    expect(contentIssues(ok)).toEqual([])
  })

  /*
   * **기준선이 걸리면 검사기가 틀린 것이다.**
   *
   * 손으로 쓴 30개는 사람이 읽고 좋다고 판단한 글이다. 여기가 걸리는
   * 검사기는 좋은 글을 버리게 만든다. prose.ts가 `~할 수 있다`와 쉼표
   * 규칙을 뺀 것도 이 시험에서 반증됐기 때문이다.
   */
  it('손으로 쓴 30개를 하나도 막지 않는다', () => {
    const blocked = EXAMPLE_NODES.filter((n) => blocking(contentIssues(n)).length > 0)
    expect(blocked.map((n) => n.question)).toEqual([])
  })
})

describe('contentIssues · 막을 것', () => {
  it('문단이 150자를 넘으면 막는다', () => {
    const long = '가'.repeat(151)
    const issues = contentIssues({ ...ok, body: `${long}\n\n:::stack\nA | B\n:::` })
    expect(blocking(issues).map((i) => i.rule)).toContain('긴문단')
  })

  it('꼬리질문이 35자를 넘으면 막는다', () => {
    const long = `${'가'.repeat(35)}는 무엇인가?`
    const issues = contentIssues({ ...ok, suggestions: [...ok.suggestions.slice(1), long] })
    expect(blocking(issues).map((i) => i.rule)).toContain('꼬리질문길이')
  })

  it('꼬리질문이 경어체면 막는다', () => {
    const issues = contentIssues({
      ...ok,
      suggestions: [...ok.suggestions.slice(1), '풀 크기는 어떻게 정하나요?'],
    })
    expect(blocking(issues).some((i) => i.rule.startsWith('꼬리질문형식'))).toBe(true)
  })

  it('꼬리질문이 5개가 아니면 막는다', () => {
    const issues = contentIssues({ ...ok, suggestions: ok.suggestions.slice(0, 3) })
    expect(blocking(issues).map((i) => i.rule)).toContain('꼬리질문수')
  })

  /*
   * 파서가 울타리 기호를 전부 털어내므로 화면에 `:::`가 보이는 일은 없다.
   * 대신 **그리려던 도식이 통째로 사라진다.** 독자에게는 안 그린 것과
   * 똑같아 보여서 이 검사가 없으면 영영 안 보인다.
   *
   * `usable()`은 파싱한 문단에서 `:::`를 찾고 있었다 — 참이 될 수 없는
   * 조건이라 한 번도 발동하지 않았다.
   */
  it('도식을 쓰려다 삼켜지면 막는다', () => {
    const issues = contentIssues({ ...ok, body: '앞말이다.\n::: flow\n앱 -> DB: 요청' })
    expect(blocking(issues).map((i) => i.rule)).toContain('도식삼킴')
  })

  it('삼켜진 것을 "도식없음"으로 뭉뚱그리지 않는다', () => {
    const rules = contentIssues({ ...ok, body: '앞말이다.\n::: flow\n앱 -> DB: 요청' }).map(
      (i) => i.rule,
    )
    expect(rules).not.toContain('도식없음')
  })

  /* 답을 말하고 곧바로 보여준다. 줄글을 세 문단 쌓은 뒤면 거기까지 안 간다 */
  it('도식이 너무 뒤에 있으면 막는다', () => {
    const body = ['하나다.', '둘이다.', '셋이다.', ':::stack\nA | B\n:::'].join('\n\n')
    expect(blocking(contentIssues({ ...ok, body })).map((i) => i.rule)).toContain('도식위치')
  })
})

describe('contentIssues · 적어만 둘 것', () => {
  /*
   * 도식이 없는 것은 정상이다. 넣을 게 없으면 넣지 말라고 프롬프트에
   * 적었고, 다시 부르면 없는 도식을 지어내게 만든다.
   */
  it('도식이 없어도 막지 않는다', () => {
    const issues = contentIssues({ ...ok, body: '한 문단이다.\n\n두 문단이다.' })
    expect(issues.map((i) => i.rule)).toContain('도식없음')
    expect(blocking(issues)).toEqual([])
  })

  it('문체가 어긋나도 막지 않는다', () => {
    const body = '인덱스를 통해 조회가 빨라진다.\n\n:::stack\nA | B\n:::'
    const issues = contentIssues({ ...ok, body })
    expect(issues.some((i) => i.rule.startsWith('문체'))).toBe(true)
    expect(blocking(issues)).toEqual([])
  })
})

describe('complaint', () => {
  /* 규칙을 다시 읊으면 무엇이 틀렸는지가 묻힌다. 틀린 자리만 짚는다 */
  it('막은 것만 담고 적어둔 것은 안 담는다', () => {
    const body = `${'가'.repeat(151)}\n\n인덱스를 통해 빨라진다.`
    const text = complaint(contentIssues({ ...ok, body }))
    expect(text).toContain('151자')
    expect(text).not.toContain('문체')
  })
})
