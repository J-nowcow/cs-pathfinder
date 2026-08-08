import { describe, it, expect } from 'vitest'
import { flowShape, actorsOf, MAX_LANES, MAX_CHAIN } from '@/lib/markdown/flow-shape'
import type { FlowStep } from '@/lib/markdown/blocks'

/**
 * 어느 `:::flow`를 기둥과 화살표로 그릴 것인가.
 *
 * 이 판정이 틀리면 **저장된 73편이 한꺼번에 나빠진다.** 파이프라인을 기둥으로
 * 그리면 단계마다 기둥이 하나씩 서고, 왕복을 목록으로 그리면 오간 것이
 * 사라진다. 그래서 판정만 따로 떼어 걸어 둔다.
 *
 * 실제 저장분에서 가져온 모양들이다. 지어낸 예가 아니다.
 */
const step = (from: string, to: string, label = ''): FlowStep => ({ from, to, label })

describe('오가는 것', () => {
  it('3-way handshake는 기둥으로 그린다', () => {
    expect(
      flowShape([
        step('클라이언트', '서버', 'SYN'),
        step('서버', '클라이언트', 'SYN + ACK'),
        step('클라이언트', '서버', 'ACK'),
      ]),
    ).toBe('sequence')
  })

  it('빌려주고 돌려받는 것도 기둥으로 그린다', () => {
    expect(
      flowShape([
        step('클라이언트', '커넥션 풀', '연결 요청'),
        step('커넥션 풀', '클라이언트', '유효한 커넥션 대여'),
        step('클라이언트', '커넥션 풀', '사용 후 반납'),
      ]),
    ).toBe('sequence')
  })
})

describe('한 줄로 이어지는 것', () => {
  /*
   * 파이프라인이다. 기둥을 세우면 마디마다 하나씩 서서 화살표가 글자보다
   * 짧아진다. 상자와 이음줄로 꿴다.
   */
  it('선형 사슬은 상자와 이음줄로 그린다', () => {
    expect(
      flowShape([
        step('소스 코드', '전처리기', '매크로 확장'),
        step('전처리기', '컴파일러', '어셈블리 생성'),
        step('컴파일러', '링커', '실행 파일 생성'),
      ]),
    ).toBe('chain')
  })

  /*
   * 마디가 아홉이면 상자와 이음줄이 화면 두 장을 넘어가 처음과 끝을 한눈에
   * 못 본다. 그때는 번호가 붙은 목록이 훑기 좋다.
   */
  it('너무 길면 손대지 않는다', () => {
    const long = Array.from({ length: MAX_CHAIN }, (_, i) => step(`n${i}`, `n${i + 1}`, `${i}`))
    expect(flowShape(long)).toBe('other')
  })

  /*
   * 한 마디에서 두 번 출발하면 갈라진 것이다. 사슬로 그리면 갈래 하나가
   * 사라지거나 없는 순서가 생긴다.
   */
  it('같은 마디에서 두 번 나가면 사슬이 아니다', () => {
    expect(
      flowShape([
        step('수집기', '미도달 객체', '회수한다'),
        step('수집기', '생존 객체', '압축한다'),
      ]),
    ).toBe('other')
  })

  /*
   * 앞 걸음의 도착과 다음 걸음의 출발이 다르면 끊긴 것이다. 이어 붙이면
   * 없던 연결을 만든다.
   */
  it('중간이 끊기면 사슬이 아니다', () => {
    expect(
      flowShape([step('A', 'B', '하나'), step('C', 'D', '둘')]),
    ).toBe('other')
  })

  it('갈라지기만 하는 것도 손대지 않는다', () => {
    expect(
      flowShape([
        step('GC 루트', '객체 그래프', '참조를 따라간다'),
        step('수집기', '미도달 객체', '메모리를 회수한다'),
        step('수집기', '생존 객체', '이동하고 압축한다'),
      ]),
    ).toBe('other')
  })
})

describe('그릴 자리가 없는 것', () => {
  /*
   * 폰 390px에서 다섯 기둥이면 칸 하나가 78px이다. 화살표가 글자보다
   * 짧아져 어디서 어디로 갔는지 눈으로 못 쫓는다.
   */
  it('마디가 다섯이면 오가더라도 손대지 않는다', () => {
    const five: FlowStep[] = [
      step('A', 'B'),
      step('B', 'A'),
      step('B', 'C'),
      step('C', 'D'),
      step('D', 'E'),
    ]
    expect(actorsOf(five)).toHaveLength(5)
    expect(five.length).toBeGreaterThan(MAX_LANES)
    expect(flowShape(five)).toBe('other')
  })

  it('걸음이 하나뿐이면 손대지 않는다', () => {
    expect(flowShape([step('호출자', '커널', 'I/O 요청')])).toBe('other')
  })

  /*
   * `A→A`만 있으면 오간 것이 아니라 제자리다. 기둥 하나에 고리만 남는다.
   */
  it('자기 자신에게만 보내면 손대지 않는다', () => {
    expect(
      flowShape([step('클라이언트', '클라이언트', '기다린다'), step('클라이언트', '클라이언트', '다시 시도')]),
    ).toBe('other')
  })
})

describe('마디를 세는 것', () => {
  it('나온 순서를 지키고 겹치지 않는다', () => {
    expect(
      actorsOf([step('앱', 'DB'), step('DB', '앱'), step('앱', '캐시')]),
    ).toEqual(['앱', 'DB', '캐시'])
  })
})
