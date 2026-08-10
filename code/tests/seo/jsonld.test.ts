import { describe, it, expect } from 'vitest'
import { plainText, serializeJsonLd, qaPageJsonLd } from '@/lib/seo/jsonld'

/**
 * 구조화 데이터.
 *
 * 여기서 제일 비싼 실수는 둘이다. 본문의 `</script>`가 스크립트 블록을
 * 그 자리에서 닫아 화면이 깨지는 것, 그리고 도식 펜스가 답 텍스트에
 * 섞여 크롤러가 읽는 답이 기호 덩어리가 되는 것.
 */
describe('평문화', () => {
  it('도식 펜스는 통째로 빠진다', () => {
    const body = '답이다.\n\n:::flow\nA -> B: 단계\n:::\n\n다음 문단이다.'
    expect(plainText(body)).toBe('답이다. 다음 문단이다.')
  })

  it('콜아웃도 펜스라 빠진다', () => {
    const body = '답이다.\n\n:::warn\n함정이다.\n:::\n\n끝이다.'
    expect(plainText(body)).toBe('답이다. 끝이다.')
  })

  it('표 행은 빠진다', () => {
    const body = '답이다.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n끝.'
    expect(plainText(body)).toBe('답이다. 끝.')
  })

  it('형광펜·볼드·코드 마크가 벗겨진다', () => {
    expect(plainText('==핵심==이고 **강조**이며 `코드`다.')).toBe('핵심이고 강조이며 코드다.')
  })
})

describe('직렬화', () => {
  it('닫는 스크립트 태그가 본문에 있어도 블록이 닫히지 않는다', () => {
    const out = serializeJsonLd({ text: '</script><b>x</b>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c')
  })
})

describe('QAPage', () => {
  it('질문과 평문 답을 담는다', () => {
    const ld = qaPageJsonLd({
      question: 'CORS는 무엇을 막는가?',
      body: '응답 읽기를 막는다.\n\n:::flow\nA -> B: x\n:::',
      url: 'https://example.com/q/16',
    }) as { '@type': string; mainEntity: { name: string; acceptedAnswer: { text: string } } }
    expect(ld['@type']).toBe('QAPage')
    expect(ld.mainEntity.name).toBe('CORS는 무엇을 막는가?')
    expect(ld.mainEntity.acceptedAnswer.text).toBe('응답 읽기를 막는다.')
  })
})
