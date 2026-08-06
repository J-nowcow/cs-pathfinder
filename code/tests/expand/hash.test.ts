import { describe, it, expect } from 'vitest'
import { normalizeText, questionHash } from '@/lib/expand/hash'
import { IDENTITY_SCOPES, isIdentityScope } from '@/lib/expand/scopes'

describe('normalizeText', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeText('  TCP   3-way   handshake란?  ')).toBe('TCP 3-way handshake란?')
  })

  it('normalizes unicode to NFC', () => {
    const decomposed = '한'
    expect(normalizeText(decomposed)).toBe('한')
  })

  it('strips zero-width characters', () => {
    expect(normalizeText('TCP​handshake')).toBe('TCPhandshake')
  })
})

describe('questionHash', () => {
  it('produces a 64 char hex digest', () => {
    expect(questionHash('network', 'TCP 3-way handshake란?')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is stable for the same input', () => {
    const a = questionHash('network', 'TCP 3-way handshake란?')
    const b = questionHash('network', 'TCP 3-way handshake란?')
    expect(a).toBe(b)
  })

  it('differs when identity scope differs', () => {
    expect(questionHash('java', '락은 언제 해제되는가?')).not.toBe(
      questionHash('os', '락은 언제 해제되는가?'),
    )
  })

  it('applies text normalization before hashing', () => {
    expect(questionHash('network', '  TCP   handshake란?  ')).toBe(
      questionHash('network', 'TCP handshake란?'),
    )
  })
})

describe('identity scopes', () => {
  it('includes generic as the fallback scope', () => {
    expect(IDENTITY_SCOPES).toContain('generic')
  })

  it('accepts a known scope', () => {
    expect(isIdentityScope('java')).toBe(true)
  })

  it('rejects an unknown scope', () => {
    expect(isIdentityScope('made-up-scope')).toBe(false)
  })
})
