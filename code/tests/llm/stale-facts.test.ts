import { describe, expect, it } from 'vitest'
import { staleFactIssues } from '@/lib/llm/stale-facts'
import { EXAMPLE_NODES } from '../../data/example-nodes'

/**
 * 교과서가 낡은 자리를 잡는가.
 *
 * **오탐이 이 검사의 전부다.** 여기 걸리면 다시 부르므로(block) 잘못 걸면
 * 14초를 버리고 멀쩡한 답을 나쁜 답으로 바꿀 수 있다. 그래서 "잡는가"보다
 * "안 잡아야 할 것을 안 잡는가"를 더 많이 시험한다.
 */
const rules = (body: string) => staleFactIssues(body).map((i) => i.rule)

describe('staleFactIssues · TLS 키 교환', () => {
  it('비대칭키로 대칭키를 전달한다고 쓰면 잡는다', () => {
    expect(
      rules('HTTPS는 대칭키로 데이터를 암호화하고 비대칭키로 그 대칭키를 안전하게 전달한다.'),
    ).toContain('낡은사실:TLS키교환')
  })

  it('프리마스터 시크릿 전달도 잡는다', () => {
    expect(
      rules('TLS 핸드셰이크는 서버 신원 확인 후 프리마스터 시크릿을 전달한다.'),
    ).toContain('낡은사실:TLS키교환')
  })

  /* 오탐 — 낡은 표현을 쓰면서 곧바로 바로잡은 글. 코퍼스에 실제로 있었다 */
  it('어디선가 합의한다고 말했으면 봐준다', () => {
    expect(
      rules(
        '하이브리드 방식은 공개키로 대칭키를 안전하게 전달한다.\n\nTLS는 세션 키를 합의하고 이후 통신은 대칭키로 한다.',
      ),
    ).not.toContain('낡은사실:TLS키교환')
  })

  it('ECDHE를 말했으면 봐준다', () => {
    expect(
      rules('TLS 1.2는 공개키로 대칭키를 전달할 수도 있지만 지금은 ECDHE를 쓴다.'),
    ).not.toContain('낡은사실:TLS키교환')
  })

  /* 주제어가 없으면 아예 안 본다 — PGP·S/MIME에서는 이 설명이 맞다 */
  it('TLS 이야기가 아니면 안 잡는다', () => {
    expect(
      rules('PGP는 공개키로 대칭키를 전달한 뒤 본문은 대칭키로 암호화한다.'),
    ).toEqual([])
  })
})

describe('staleFactIssues · TLS 상호 인증', () => {
  it('서로의 신원을 확인한다고 쓰면 잡는다', () => {
    expect(rules('TLS 핸드셰이크에서 클라이언트와 서버가 서로의 신원을 확인한다.')).toContain(
      '낡은사실:TLS상호인증',
    )
  })

  it('서버만 인증한다고 쓰면 안 잡는다', () => {
    expect(
      rules('TLS에서 클라이언트는 서버의 신원을 확인한다. 반대는 mTLS를 써야 한다.'),
    ).toEqual([])
  })
})

describe('staleFactIssues · 교착 회피의 정의', () => {
  it('회피를 조건 제거로 설명하면 잡는다', () => {
    expect(
      rules('교착 상태 회피는 교착이 발생할 수 있는 상황을 아예 만들지 않는 것이다.'),
    ).toContain('낡은사실:교착회피정의')
  })

  /* 이것이 예방의 올바른 설명이다. 회피가 아니라고 했으므로 안 잡아야 한다 */
  it('예방을 조건 제거로 설명하면 안 잡는다', () => {
    expect(
      rules('교착 상태 예방은 네 조건 중 하나를 아예 만들지 않는 것이다.'),
    ).toEqual([])
  })

  it('회피를 안전 상태 검사로 설명하면 안 잡는다', () => {
    expect(
      rules('교착 상태 회피는 요청마다 안전 상태인지 검사해 안전할 때만 자원을 내준다.'),
    ).toEqual([])
  })
})

describe('staleFactIssues · 다익스트라의 조건', () => {
  it('양수 가중치라고 쓰면 잡는다', () => {
    expect(rules('양수 가중치만 있다면 다익스트라를 쓴다.')).toContain('낡은사실:다익스트라조건')
  })

  it('비음수라고 쓰면 안 잡는다', () => {
    expect(rules('가중치가 모두 0 이상이면 다익스트라를 쓴다.')).toEqual([])
  })

  /* 다익스트라 이야기가 아니면 "양수 가중치"가 멀쩡한 말이다 */
  it('다익스트라가 없으면 안 잡는다', () => {
    expect(rules('양수 가중치만 있는 그래프를 다룬다.')).toEqual([])
  })
})

describe('staleFactIssues · 전환할 때 캐시를 비운다', () => {
  it('TLB를 통째로 비운다고 쓰면 잡는다', () => {
    expect(
      rules('컨텍스트 스위칭이 일어나면 주소 공간이 바뀌어 TLB를 통째로 비운다.'),
    ).toContain('낡은사실:전환시캐시무효화')
  })

  /* 오탐 — 비운다고 쓰고 곧바로 ASID를 말한 글. 코퍼스에 실제로 있었다 */
  it('ASID를 말했으면 봐준다', () => {
    expect(
      rules(
        '컨텍스트 스위칭이 발생하면 TLB를 모두 비운다. ASID를 쓰면 플러시를 줄일 수 있다.',
      ),
    ).not.toContain('낡은사실:전환시캐시무효화')
  })

  it('밀려난다고 쓰면 안 잡는다', () => {
    expect(
      rules('컨텍스트 스위칭 뒤에는 새 스레드의 작업 집합이 캐시를 밀어낸다.'),
    ).toEqual([])
  })
})

/**
 * 기준선.
 *
 * 손으로 쓴 30편은 사람이 검토한 글이다. 여기서 하나라도 걸리면 검사기가
 * 틀린 것이다 — 좋은 글을 버리게 만드는 검사기는 없느니만 못하다.
 */
describe('staleFactIssues · 기준선', () => {
  it('손으로 쓴 30편에서 하나도 안 걸린다', () => {
    const hits = EXAMPLE_NODES.flatMap((n) =>
      staleFactIssues(n.body).map((i) => `${n.question}: ${i.rule}`),
    )
    expect(hits).toEqual([])
  })
})
