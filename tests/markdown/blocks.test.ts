import { describe, it, expect } from 'vitest'
import { parseBlocks } from '@/lib/markdown/blocks'

/**
 * 파서의 가장 중요한 성질은 **절대 본문을 먹지 않는 것**이다.
 *
 * 모델이 문법을 조금 틀렸다고 해설이 빈 화면이 되면, 도식을 넣어서 얻은 것보다
 * 잃는 것이 크다. 못 알아본 것은 전부 문단으로 떨어진다.
 */
describe('parseBlocks — 문단', () => {
  it('splits on blank lines', () => {
    const out = parseBlocks('첫 문단이다.\n\n둘째 문단이다.')
    expect(out).toEqual([
      { type: 'paragraph', text: '첫 문단이다.' },
      { type: 'paragraph', text: '둘째 문단이다.' },
    ])
  })

  it('keeps a single newline inside one paragraph', () => {
    const out = parseBlocks('한 문단인데\n줄만 바뀐 것이다.')
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ type: 'paragraph', text: '한 문단인데\n줄만 바뀐 것이다.' })
  })

  it('drops empty input', () => {
    expect(parseBlocks('')).toEqual([])
    expect(parseBlocks('\n\n  \n')).toEqual([])
  })
})

describe('parseBlocks — flow', () => {
  it('reads actors and labels', () => {
    const out = parseBlocks(
      ['앞 문단.', '', ':::flow', '클라이언트 -> 서버: SYN', '서버 -> 클라이언트: SYN + ACK', ':::', '', '뒤 문단.'].join('\n'),
    )

    expect(out).toEqual([
      { type: 'paragraph', text: '앞 문단.' },
      {
        type: 'flow',
        steps: [
          { from: '클라이언트', to: '서버', label: 'SYN' },
          { from: '서버', to: '클라이언트', label: 'SYN + ACK' },
        ],
      },
      { type: 'paragraph', text: '뒤 문단.' },
    ])
  })

  /** 모델이 화살표를 어떻게 쓸지 고르지 않는다. 셋 다 받는다 */
  it('accepts ->, →, and =>', () => {
    const out = parseBlocks([':::flow', 'A -> B: 하나', 'B → C: 둘', 'C => D: 셋', ':::'].join('\n'))
    expect(out[0].type).toBe('flow')
    if (out[0].type === 'flow') expect(out[0].steps).toHaveLength(3)
  })

  it('keeps a colon inside the label', () => {
    const out = parseBlocks([':::flow', '클라이언트 -> 서버: GET /users: 목록 요청', ':::'].join('\n'))
    if (out[0].type === 'flow') {
      expect(out[0].steps[0].label).toBe('GET /users: 목록 요청')
    }
  })

  /** 한 줄이라도 문법이 틀리면 도식이 아니다. 반쪽짜리 도식보다 글이 낫다 */
  it('falls back to a paragraph when a line is malformed', () => {
    const out = parseBlocks([':::flow', '클라이언트 -> 서버: SYN', '이건 화살표가 없다', ':::'].join('\n'))
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('paragraph')
    if (out[0].type === 'paragraph') {
      expect(out[0].text).toContain('SYN')
      expect(out[0].text).not.toContain(':::')
    }
  })

  it('treats an unclosed fence as plain text', () => {
    const out = parseBlocks([':::flow', '클라이언트 -> 서버: SYN'].join('\n'))
    expect(out.every((b) => b.type === 'paragraph')).toBe(true)
  })
})

describe('parseBlocks — stack', () => {
  it('reads layers with and without notes', () => {
    const out = parseBlocks([':::stack', '애플리케이션 | HTTP, DNS', '전송 | TCP, UDP', '네트워크', ':::'].join('\n'))

    expect(out).toEqual([
      {
        type: 'stack',
        layers: [
          { name: '애플리케이션', note: 'HTTP, DNS' },
          { name: '전송', note: 'TCP, UDP' },
          { name: '네트워크', note: '' },
        ],
      },
    ])
  })

  it('ignores blank lines inside the fence', () => {
    const out = parseBlocks([':::stack', '위', '', '아래', ':::'].join('\n'))
    if (out[0].type === 'stack') expect(out[0].layers).toHaveLength(2)
  })
})

describe('parseBlocks — 표', () => {
  it('reads a markdown table', () => {
    const out = parseBlocks(
      ['| 기준 | 낙관적 | 비관적 |', '| --- | --- | --- |', '| 충돌 | 드물다 | 잦다 |'].join('\n'),
    )

    expect(out).toEqual([
      {
        type: 'table',
        head: ['기준', '낙관적', '비관적'],
        rows: [['충돌', '드물다', '잦다']],
      },
    ])
  })

  it('accepts a table without outer pipes', () => {
    const out = parseBlocks(['기준 | 값', '--- | ---', '충돌 | 드물다'].join('\n'))
    expect(out[0].type).toBe('table')
  })

  /**
   * 파이프 하나 들어간 문장을 표로 오인하면 본문이 깨진다.
   * 구분줄이 있어야만 표로 본다.
   */
  it('does not mistake a sentence with a pipe for a table', () => {
    const out = parseBlocks('셸에서 `a | b` 처럼 파이프로 잇는다.\n또 한 줄.\n그리고 한 줄.')
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('paragraph')
  })

  /** 칸 수가 어긋나면 억지로 맞추지 않는다. 엉뚱한 칸에 값이 들어간다 */
  it('rejects a table whose rows do not line up', () => {
    const out = parseBlocks(['| 기준 | 값 |', '| --- | --- |', '| 충돌 | 드물다 | 남는 칸 |'].join('\n'))
    expect(out[0].type).toBe('paragraph')
  })

  it('needs at least one body row', () => {
    const out = parseBlocks(['| 기준 | 값 |', '| --- | --- |'].join('\n'))
    expect(out[0].type).toBe('paragraph')
  })
})

describe('parseBlocks — 섞였을 때', () => {
  it('keeps everything in order', () => {
    const body = [
      '결론 문단이다.',
      '',
      ':::flow',
      'A -> B: 첫 단계',
      ':::',
      '',
      '설명 문단이다.',
      '',
      '| 기준 | 값 |',
      '| --- | --- |',
      '| 하나 | 둘 |',
      '',
      ':::stack',
      '위 | 설명',
      ':::',
      '',
      '마무리 문단이다.',
    ].join('\n')

    expect(parseBlocks(body).map((b) => b.type)).toEqual([
      'paragraph',
      'flow',
      'paragraph',
      'table',
      'stack',
      'paragraph',
    ])
  })

  /** 도식이 하나도 없는 옛 해설이 그대로 나와야 한다 */
  it('handles a body with no diagrams at all', () => {
    const body = '첫째 문단.\n\n둘째 문단.\n\n셋째 문단.'
    expect(parseBlocks(body).map((b) => b.type)).toEqual(['paragraph', 'paragraph', 'paragraph'])
  })

  it('never throws on junk', () => {
    const junk = [':::', ':::flow', '|||', '-> : ', ':::stack', '', '|', '::: ::: :::']
    for (const j of junk) expect(() => parseBlocks(j)).not.toThrow()
  })
})

describe('parseBlocks — 모델이 조금씩 다르게 쓸 때', () => {
  /**
   * 실측에서 나온 변형들이다. 엄격하게 보면 그때마다 도식이 통째로 문단이 되고
   * 화면에 `:::` 기호가 그대로 뜬다.
   */
  it('accepts a space after the fence marker', () => {
    const out = parseBlocks([':::  flow', 'A -> B: 하나', ':::'].join('\n'))
    expect(out[0].type).toBe('flow')
  })

  it('accepts trailing words after the type', () => {
    const out = parseBlocks([':::flow 핸드셰이크 순서', 'A -> B: 하나', ':::'].join('\n'))
    expect(out[0].type).toBe('flow')
  })

  it('accepts :::end as a close', () => {
    const out = parseBlocks([':::stack', '위 | 설명', ':::end'].join('\n'))
    expect(out[0].type).toBe('stack')
  })

  /**
   * 도식을 못 그리는 것은 아쉬운 정도지만, `:::`가 화면에 보이는 것은
   * 고장으로 읽힌다. 마지막 그물이 있어야 한다.
   */
  it('never leaks a fence marker into the text', () => {
    const bodies = [
      '앞 문단.\n\n::::flow\n이상한 것\n::::\n\n뒤 문단.',
      '앞 문단.\n\n```\n:::flow\nA -> B: 하나\n```\n\n뒤 문단.',
      ':::flowchart\nA -> B\n:::',
    ]
    for (const body of bodies) {
      for (const b of parseBlocks(body)) {
        if (b.type === 'paragraph') {
          expect(b.text).not.toContain(':::')
          expect(b.text).not.toContain('```')
        }
      }
    }
  })
})
