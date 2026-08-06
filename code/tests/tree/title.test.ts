import { describe, it, expect } from 'vitest'
import {
  deriveTitle,
  normalizeTitle,
  deriveSummary,
  MAX_TITLE_LENGTH,
  MAX_SUMMARY_LENGTH,
} from '@/lib/tree/title'

const ROOT = 'TCP 연결을 끊을 때 TIME_WAIT 상태가 필요한 이유는?'

describe('deriveTitle', () => {
  it('uses the root question as it is when it fits', () => {
    expect(deriveTitle(ROOT)).toBe(ROOT)
  })

  it('cuts an overlong question and marks the cut', () => {
    const long = '가'.repeat(MAX_TITLE_LENGTH + 40)
    const got = deriveTitle(long)
    expect(got.length).toBe(MAX_TITLE_LENGTH)
    expect(got.endsWith('…')).toBe(true)
  })

  it('collapses line breaks so the card and the og tag stay one line', () => {
    expect(deriveTitle('앞줄\n\n뒷줄')).toBe('앞줄 뒷줄')
  })

  it('falls back when the root question is blank', () => {
    expect(deriveTitle('   ')).toBe('이름 없는 트리')
  })
})

describe('normalizeTitle', () => {
  it('prefers what the sharer typed', () => {
    expect(normalizeTitle('내 첫 트리', ROOT)).toBe('내 첫 트리')
  })

  it('falls back to the root question when nothing was typed', () => {
    expect(normalizeTitle('', ROOT)).toBe(ROOT)
    expect(normalizeTitle(null, ROOT)).toBe(ROOT)
    expect(normalizeTitle(undefined, ROOT)).toBe(ROOT)
    expect(normalizeTitle('   \n ', ROOT)).toBe(ROOT)
  })

  it('strips invisible characters', () => {
    // 폭 없는 문자는 제목 길이 제한을 우회하고 게시판에서 빈 카드처럼 보인다.
    // 소스에 그대로 박으면 이 테스트가 무엇을 재는지 눈으로 확인할 수 없어 코드로 조립한다
    const ZWSP = String.fromCharCode(0x200b)
    const BOM = String.fromCharCode(0xfeff)
    expect(normalizeTitle(`제${ZWSP}목${BOM}`, ROOT)).toBe('제목')
    // 낱말 사이의 BOM이 공백으로 바뀌면 없던 띄어쓰기가 생긴다
    expect(normalizeTitle(`제${BOM}목`, ROOT)).toBe('제목')
  })

  it('strips control characters', () => {
    const ESC = String.fromCharCode(0x1b)
    expect(normalizeTitle(`제목${ESC}[31m`, ROOT)).toBe('제목[31m')
  })

  it('caps what the sharer typed at the same limit', () => {
    expect(normalizeTitle('나'.repeat(500), ROOT).length).toBe(MAX_TITLE_LENGTH)
  })
})

describe('deriveSummary', () => {
  it('draws the trail with arrows', () => {
    expect(deriveSummary(['첫 질문', '둘째 질문', '셋째 질문'], 3)).toBe(
      '첫 질문 → 둘째 질문 → 셋째 질문',
    )
  })

  it('counts the branches that are not on the shown trail', () => {
    expect(deriveSummary(['첫 질문', '둘째 질문'], 5)).toBe('첫 질문 → 둘째 질문 외 3개')
  })

  it('stays inside the length a link preview will show', () => {
    const trail = Array.from({ length: 12 }, (_, i) => `${'질문'.repeat(8)}${i}`)
    const got = deriveSummary(trail, 30)
    expect(got.length).toBeLessThanOrEqual(MAX_SUMMARY_LENGTH)
  })

  it('says something rather than nothing for a lone root', () => {
    expect(deriveSummary(['혼자 있는 질문'], 1)).toBe('혼자 있는 질문')
  })

  it('returns empty for an empty trail', () => {
    expect(deriveSummary([], 0)).toBe('')
  })
})
