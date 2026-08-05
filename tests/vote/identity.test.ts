import { describe, it, expect } from 'vitest'
import { isVoterId, newVoterId, voterKey } from '@/lib/vote/identity'

describe('voter identity', () => {
  it('accepts what it generates', () => {
    for (let i = 0; i < 20; i += 1) expect(isVoterId(newVoterId())).toBe(true)
  })

  /**
   * 쿠키는 사용자가 고칠 수 있다. 그대로 DB 키가 되면 길이 제한 없는 임의
   * 문자열이 voter_key로 들어가고, 인덱스만 불린다.
   */
  it('rejects anything it did not generate', () => {
    expect(isVoterId(undefined)).toBe(false)
    expect(isVoterId(null)).toBe(false)
    expect(isVoterId('')).toBe(false)
    expect(isVoterId('anon:1')).toBe(false)
    expect(isVoterId('../../etc/passwd')).toBe(false)
    expect(isVoterId('x'.repeat(500))).toBe(false)
    // 모양은 비슷하지만 한 자리가 모자라다
    expect(isVoterId('11111111-1111-4111-8111-11111111111')).toBe(false)
  })

  /** 인증이 붙으면 user: 접두가 같은 자리에 온다. 익명 표와 안 섞이는 것이 중요하다 */
  it('namespaces anonymous keys', () => {
    const id = newVoterId()
    expect(voterKey(id)).toBe(`anon:${id}`)
    expect(voterKey(id).startsWith('anon:')).toBe(true)
  })
})
