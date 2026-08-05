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
