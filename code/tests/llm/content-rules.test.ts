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

  /*
   * 실제로 나간 결함이다.
   *
   * 공유받은 사람이 첫 화면에서 "락 락 획득을 시도하는", "성능이 성능이
   * 향상된다"를 봤다. 뜻은 통하지만 읽는 쪽은 고장으로 받아들인다.
   */
  it('같은 낱말이 붙어 나오면 막는다', () => {
    const body = '스핀 락은 계속해서 락 락 획득을 시도한다.\n\n:::stack\nA | B\n:::'
    expect(blocking(contentIssues({ ...ok, body })).map((i) => i.rule)).toContain('낱말반복')
  })

  /*
   * 도식은 이 검사를 안 받는다.
   *
   * 줄바꿈을 넘게 했더니 stack에서 오탐이 났다 — `코드 | 정적 데이터` 다음
   * 줄이 `데이터 | 전역 변수`라 `데이터\n데이터`가 걸렸다. 멀쩡한 도식이다.
   */
  it('도식의 줄 사이는 반복으로 보지 않는다', () => {
    const body = '주소 공간을 나눈다.\n\n:::stack\n코드 | 정적 데이터\n데이터 | 전역 변수\n:::'
    expect(blocking(contentIssues({ ...ok, body }))).toEqual([])
  })

  /*
   * 음절로 잡으면 멀쩡한 글이 걸린다. `사이사이`·`스스로`·`질의의`가
   * 손으로 쓴 30개에 실제로 있고, 그 방식으로는 33%가 걸렸다.
   */
  it('한 낱말 안의 되풀이는 건드리지 않는다', () => {
    const body = '사이사이 스스로 질의의 결과를 본다.\n\n:::stack\nA | B\n:::'
    expect(blocking(contentIssues({ ...ok, body }))).toEqual([])
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

/**
 * 도식이 제 뜻에 맞게 쓰였는가.
 *
 * 실측에서 도피처가 표가 아니라 **stack**이었다. 표 127개 중 형태가 틀린
 * 것이 30개(24%)인데 stack 56개 중에서는 23개(41%)다.
 *
 * 파서가 이유를 설명한다 — `parseStack`은 절대 실패하지 않는다. 비어 있지
 * 않은 모든 줄을 층으로 받는다. flow는 화살표가 없으면 null, 표는 구분줄이
 * 없으면 null인데 stack만 무엇이든 삼킨다.
 */
describe('contentIssues · 도식 오용', () => {
  const withDiagram = (d: string) => ({ ...ok, body: `답이다.\n\n${d}` })

  /*
   * 2층 stack은 계층이 아니라 둘을 나란히 놓은 것이다. 위아래로 쌓으면
   * 읽는 사람이 없는 계층을 지어낸다("WAS가 웹 서버 아래층인가").
   * 생성분 56개 중 30개가 2층이었다.
   */
  it('2층 계층은 적어둔다', () => {
    const issues = contentIssues(withDiagram(':::stack\n웹 서버 | 정적 파일\nWAS | 동적 콘텐츠\n:::'))
    expect(issues.map((i) => i.rule)).toContain('얕은계층')
    expect(blocking(issues)).toEqual([])
  })

  it('3층부터는 계층으로 인정한다', () => {
    const issues = contentIssues(
      withDiagram(':::stack\n애플리케이션 | HTTP\n전송 | TCP\n네트워크 | IP\n:::'),
    )
    expect(issues.map((i) => i.rule)).not.toContain('얕은계층')
  })

  /*
   * 이건 지금 화면에서 실제로 깨지고 있다. `--- | ---`이 이름이 `---`이고
   * 설명이 `---`인 층으로 그대로 그려진다. 생성분에 2건 있다.
   */
  /*
   * 계층 안에 넣은 표는 여러 모양으로 온다. 프롬프트의 표 예시가 바깥
   * 파이프를 쓰므로(`| --- | --- |`) 그것을 그대로 계층에 넣는 경우를
   * 놓치면 안 된다. `parseStack`이 이름 `| ---`·설명 `--- |`로 쪼갠다.
   */
  it.each([
    ['--- | ---', '가운데 파이프'],
    ['| --- | --- |', '바깥 파이프'],
    [':--- | ---:', '정렬 표시'],
    ['---', '한 칸짜리'],
  ])('계층 안의 구분줄 %s (%s)을 막는다', (rule) => {
    const issues = contentIssues(withDiagram(`:::stack\n상태 코드 | 분류\n${rule}\n1xx | 정보\n:::`))
    expect(blocking(issues).map((i) => i.rule)).toContain('표를계층에')
  })

  /*
   * **막지 않는다.** 좁은 화면에서 표는 줄 단위 카드로 접히므로 열이 늘어도
   * 뭉개지지 않는다(`Diagram.tsx`·`globals.css`). 처음에 막았던 근거가
   * 렌더러를 다시 보니 사라졌다.
   *
   * 막으면 오히려 나쁘다 — 다시 부른 결과는 **지적 수가 줄기만 하면**
   * 채택되므로, 비교 대상 하나를 빼고 3열로 만든 답이 이긴다. 읽기
   * 편해지자고 견줄 것을 잃는다.
   */
  it('표가 네 열이면 적어만 둔다', () => {
    const t = '| 기준 | A | B | C |\n| --- | --- | --- | --- |\n| 값 | 1 | 2 | 3 |\n| 값2 | 4 | 5 | 6 |'
    const issues = contentIssues(withDiagram(t))
    expect(issues.map((i) => i.rule)).toContain('표열수')
    expect(blocking(issues)).toEqual([])
  })

  it('세 열까지는 통과한다', () => {
    const t = '| 기준 | A | B |\n| --- | --- | --- |\n| 값 | 1 | 2 |\n| 값2 | 3 | 4 |'
    expect(blocking(contentIssues(withDiagram(t)))).toEqual([])
  })

  /* 한 줄짜리 표는 견주는 것이 아니라 문장이다. 막지는 않는다 */
  it('한 줄짜리 표는 적어둔다', () => {
    const t = '| 기준 | A | B |\n| --- | --- | --- |\n| 값 | 1 | 2 |'
    const issues = contentIssues(withDiagram(t))
    expect(issues.map((i) => i.rule)).toContain('표한줄')
    expect(blocking(issues)).toEqual([])
  })
})
