import { describe, it, expect } from 'vitest'
import { parseInline, splitParagraphs } from '@/lib/markdown/inline'

describe('splitParagraphs', () => {
  it('splits on blank lines', () => {
    expect(splitParagraphs('첫째\n\n둘째')).toEqual(['첫째', '둘째'])
  })

  it('drops empty chunks from repeated blank lines', () => {
    expect(splitParagraphs('첫째\n\n\n\n둘째')).toEqual(['첫째', '둘째'])
  })

  it('returns empty for blank input', () => {
    expect(splitParagraphs('   ')).toEqual([])
  })
})

describe('parseInline', () => {
  it('returns plain text as a single token', () => {
    expect(parseInline('보통 문장')).toEqual([{ type: 'text', value: '보통 문장' }])
  })

  it('extracts bold segments', () => {
    expect(parseInline('앞 **강조** 뒤')).toEqual([
      { type: 'text', value: '앞 ' },
      { type: 'bold', value: '강조' },
      { type: 'text', value: ' 뒤' },
    ])
  })

  it('extracts inline code', () => {
    expect(parseInline('값은 `null`이다')).toEqual([
      { type: 'text', value: '값은 ' },
      { type: 'code', value: 'null' },
      { type: 'text', value: '이다' },
    ])
  })

  it('handles both markers in one paragraph', () => {
    const r = parseInline('**A**와 `b`')
    expect(r.map((t) => t.type)).toEqual(['bold', 'text', 'code'])
  })

  it('leaves an unclosed marker as literal text', () => {
    // 생성 결과가 늘 온전하지는 않다. 깨진 마크업이 본문을 먹어치우면 안 된다.
    expect(parseInline('**닫히지 않음')).toEqual([{ type: 'text', value: '**닫히지 않음' }])
  })

  it('does not treat an empty marker pair as bold', () => {
    expect(parseInline('****')).toEqual([{ type: 'text', value: '****' }])
  })

  it('keeps html-looking text as literal so nothing is injected', () => {
    // 자유 입력이 전역 자산이 되므로 오염이 증폭된다. 텍스트로만 다룬다.
    const r = parseInline('<script>alert(1)</script>')
    expect(r).toEqual([{ type: 'text', value: '<script>alert(1)</script>' }])
  })
})

/**
 * LaTeX.
 *
 * 프롬프트가 시킨 적 없는데 모델이 쓴다. 화면을 열어 세어보니 노드 다섯 개에서
 * `$O(1)$`이 표 칸에 달러 기호째로 찍혀 있었다. 파서가 모르는 표기는 문자
 * 그대로 나가고 그게 고장으로 읽힌다.
 *
 * 렌더링은 안 한다 — KaTeX는 2MB고 여기 수식은 `O(n)`이 거의 전부라 코드
 * 조각으로 충분하다.
 */
describe('parseInline · LaTeX', () => {
  it('unwraps a math span into code', () => {
    expect(parseInline('접근은 $O(1)$이다.')).toEqual([
      { type: 'text', value: '접근은 ' },
      { type: 'code', value: 'O(1)' },
      { type: 'text', value: '이다.' },
    ])
  })

  /* 실제로 나온 명령만 바꾼다. 그 둘이 전부였다 */
  it('turns the commands that actually appeared into symbols', () => {
    expect(parseInline('$O(\\log N)$')[0]).toEqual({ type: 'code', value: 'O(log N)' })
    expect(parseInline('$A \\rightarrow B$')[0]).toEqual({ type: 'code', value: 'A → B' })
  })

  /* 모르는 명령은 백슬래시만 뗀다. 지우면 뜻이 사라진다 */
  it('keeps an unknown command readable', () => {
    expect(parseInline('$\\alpha$')[0]).toEqual({ type: 'code', value: 'alpha' })
  })

  /* 값 하나짜리 달러는 마크업이 아니다. 가격이 코드로 바뀌면 안 된다 */
  it('leaves a lone dollar alone', () => {
    expect(parseInline('가격은 $5 이다.')).toEqual([{ type: 'text', value: '가격은 $5 이다.' }])
  })

  /* 줄을 넘어가면 수식이 아니다. 두 문단이 통째로 코드가 되는 것을 막는다 */
  it('does not span a line break', () => {
    const out = parseInline('$5 짜리\n다른 줄 $9')
    expect(out.every((t) => t.type === 'text')).toBe(true)
  })
})
