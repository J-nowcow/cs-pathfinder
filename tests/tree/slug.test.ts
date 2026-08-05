import { describe, it, expect } from 'vitest'
import { newSlug, SLUG_LENGTH, SLUG_ALPHABET, isValidSlug } from '@/lib/tree/slug'

describe('slug', () => {
  it('has the declared length', () => {
    expect(newSlug()).toHaveLength(SLUG_LENGTH)
  })

  it('only uses the declared alphabet', () => {
    for (let i = 0; i < 200; i += 1) {
      for (const ch of newSlug()) {
        expect(SLUG_ALPHABET).toContain(ch)
      }
    }
  })

  it('excludes characters that get misread when typed by hand', () => {
    // 0/o, 1/l/i 는 카톡에서 링크를 눈으로 옮겨 적을 때 갈린다
    for (const ch of ['0', 'o', '1', 'l', 'i']) {
      expect(SLUG_ALPHABET).not.toContain(ch)
    }
  })

  it('does not repeat across a large batch', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 5000; i += 1) seen.add(newSlug())
    expect(seen.size).toBe(5000)
  })

  it('spreads across the alphabet instead of favouring the low end', () => {
    // 256 % 알파벳 크기가 0이 아니면 모듈로 편향이 생긴다. 앞 글자가 더 자주 나온다.
    const counts = new Map<string, number>()
    for (let i = 0; i < 4000; i += 1) {
      for (const ch of newSlug()) counts.set(ch, (counts.get(ch) ?? 0) + 1)
    }
    expect(counts.size).toBe(SLUG_ALPHABET.length)

    const expected = (4000 * SLUG_LENGTH) / SLUG_ALPHABET.length
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(expected * 0.7)
      expect(n).toBeLessThan(expected * 1.3)
    }
  })

  it('accepts what it generates', () => {
    for (let i = 0; i < 50; i += 1) expect(isValidSlug(newSlug())).toBe(true)
  })

  it('rejects wrong length, wrong alphabet, and junk', () => {
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug('abc')).toBe(false)
    expect(isValidSlug('a'.repeat(SLUG_LENGTH + 1))).toBe(false)
    expect(isValidSlug('0'.repeat(SLUG_LENGTH))).toBe(false)
    expect(isValidSlug('../etc/passw')).toBe(false)
    expect(isValidSlug('가'.repeat(SLUG_LENGTH))).toBe(false)
  })
})
