import { describe, it, expect } from 'vitest'
import {
  initialOf,
  sortEntries,
  filterEntries,
  groupByInitial,
  groupAnchor,
  ALL_ENTRIES,
  LATIN_BUCKET,
  OTHER_BUCKET,
} from '@/lib/glossary/catalog'
import { GLOSSARY } from '../../data/glossary'

/**
 * 사전 페이지의 계산부.
 *
 * 초성 판정이 틀리면 인덱스 바가 엉뚱한 자리로 보내고, 정렬이 틀리면
 * 가나다로 훑는 사람이 있는 용어를 못 찾는다. 화면 없이 잴 수 있는
 * 것들이라 여기 묶어 둔다.
 */
const e = (term: string, short = '뜻') => ({ term, short })

describe('초성 판정', () => {
  it('한글 음절에서 초성을 뽑는다', () => {
    expect(initialOf('가용성')).toBe('ㄱ')
    expect(initialOf('스레드')).toBe('ㅅ')
    expect(initialOf('힙')).toBe('ㅎ')
    expect(initialOf('이벤트 루프')).toBe('ㅇ')
  })

  /* 종성이 있든 없든 같은 칸이어야 한다 — 588로 나누는 계산이 그것을 보장한다 */
  it('받침이 있어도 같은 칸이다', () => {
    expect(initialOf('스택')).toBe(initialOf('스레드'))
  })

  /* 칸이 19개면 폰에서 두 줄이 된다. 된소리는 예사소리에 붙인다 */
  it('된소리는 예사소리 칸으로 접는다', () => {
    expect(initialOf('꼬리')).toBe('ㄱ')
    expect(initialOf('딸기')).toBe('ㄷ')
    expect(initialOf('빵')).toBe('ㅂ')
    expect(initialOf('쌍따옴표')).toBe('ㅅ')
    expect(initialOf('짝수')).toBe('ㅈ')
  })

  it('영문은 대소문자를 가리지 않고 한 칸이다', () => {
    expect(initialOf('API')).toBe(LATIN_BUCKET)
    expect(initialOf('B-Tree')).toBe(LATIN_BUCKET)
    expect(initialOf('gRPC')).toBe(LATIN_BUCKET)
  })

  /* 떨어뜨리지 않는다. 숫자로 시작하는 용어가 들어와도 자리가 있어야 한다 */
  it('한글도 영문도 아니면 기타 칸이다', () => {
    expect(initialOf('3-way handshake')).toBe(OTHER_BUCKET)
  })
})

describe('정렬', () => {
  it('한글이 먼저, 영문이 뒤다', () => {
    const sorted = sortEntries([e('API'), e('힙'), e('TCP'), e('가용성')])
    expect(sorted.map((x) => x.term)).toEqual(['가용성', '힙', 'API', 'TCP'])
  })

  it('한글끼리는 가나다순이다', () => {
    const sorted = sortEntries([e('힙'), e('스레드'), e('가용성'), e('노드')])
    expect(sorted.map((x) => x.term)).toEqual(['가용성', '노드', '스레드', '힙'])
  })

  it('영문끼리는 알파벳순이다', () => {
    const sorted = sortEntries([e('TCP'), e('ACK'), e('DOM')])
    expect(sorted.map((x) => x.term)).toEqual(['ACK', 'DOM', 'TCP'])
  })

  /* 원본을 뒤집으면 data/glossary.ts의 등재 순서가 사라진다 */
  it('원본 배열을 건드리지 않는다', () => {
    const input = [e('힙'), e('가용성')]
    sortEntries(input)
    expect(input.map((x) => x.term)).toEqual(['힙', '가용성'])
  })
})

describe('검색', () => {
  const entries = [
    e('GC', '더는 쓸 수 없게 된 메모리를 런타임이 알아서 회수하는 일.'),
    e('스레드', '프로세스 안에서 명령을 실행하는 흐름.'),
  ]

  it('빈 검색어는 전부 돌려준다', () => {
    expect(filterEntries(entries, '')).toHaveLength(2)
    expect(filterEntries(entries, '   ')).toHaveLength(2)
  })

  it('용어로 찾는다', () => {
    expect(filterEntries(entries, '스레').map((x) => x.term)).toEqual(['스레드'])
  })

  /* 이름을 모르니까 찾는다. 뜻으로도 닿아야 사전 노릇을 한다 */
  it('뜻으로도 찾는다', () => {
    expect(filterEntries(entries, '회수').map((x) => x.term)).toEqual(['GC'])
  })

  /* tcp로 쳐서 TCP가 안 나오면 사람은 고장으로 본다 */
  it('대소문자를 가리지 않는다', () => {
    expect(filterEntries(entries, 'gc').map((x) => x.term)).toEqual(['GC'])
    expect(filterEntries([e('TCP')], 'tcp')).toHaveLength(1)
  })

  it('없으면 빈 목록이다', () => {
    expect(filterEntries(entries, '없는말')).toEqual([])
  })
})

describe('구간 나누기', () => {
  it('초성별로 묶고 순서를 지킨다', () => {
    const groups = groupByInitial([e('API'), e('힙'), e('가용성'), e('노드')])
    expect(groups.map((g) => g.initial)).toEqual(['ㄱ', 'ㄴ', 'ㅎ', LATIN_BUCKET])
  })

  it('같은 초성은 한 묶음이다', () => {
    const groups = groupByInitial([e('스레드'), e('스택'), e('가용성')])
    expect(groups).toHaveLength(2)
    expect(groups[1].entries.map((x) => x.term)).toEqual(['스레드', '스택'])
  })

  /* 인덱스 바는 이 결과로 그린다. 빈 칸이 남으면 눌러도 아무 데도 안 간다 */
  it('걸러진 뒤 사라진 초성은 칸도 없다', () => {
    const groups = groupByInitial(filterEntries([e('스레드'), e('가용성')], '스레'))
    expect(groups.map((g) => g.initial)).toEqual(['ㅅ'])
  })

  it('빈 목록이면 구간도 없다', () => {
    expect(groupByInitial([])).toEqual([])
  })
})

/* 용어 앵커는 id={term}이다. 구간 머리글이 그것과 겹치면 본문 링크가 엉뚱한 데로 간다 */
describe('구간 앵커', () => {
  it('용어 이름과 겹치지 않는다', () => {
    const terms = new Set(GLOSSARY.map((g) => g.term))
    for (const g of groupByInitial(GLOSSARY)) {
      expect(terms.has(groupAnchor(g.initial))).toBe(false)
    }
  })

  it('공백이 없다 — id로 쓸 수 있어야 한다', () => {
    expect(groupAnchor('ㄱ')).not.toMatch(/\s/)
  })
})

describe('실제 사전', () => {
  /* 같은 용어가 둘이면 React key가 겹치고 앵커도 둘이 된다 */
  it('용어가 중복되지 않는다', () => {
    expect(new Set(GLOSSARY.map((g) => g.term)).size).toBe(GLOSSARY.length)
  })

  it('모든 항목에 뜻이 있다', () => {
    for (const g of GLOSSARY) expect(g.short.trim().length).toBeGreaterThan(0)
  })

  it('정렬해도 개수가 그대로다', () => {
    expect(ALL_ENTRIES).toHaveLength(GLOSSARY.length)
  })
})
