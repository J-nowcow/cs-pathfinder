import { describe, expect, it } from 'vitest'
import { redactGithubSecrets } from '@/lib/personalize/github-redaction'

describe('GitHub 공개 자료 비밀정보 제거', () => {
  it.each([
    ['API_KEY=super-secret-value', 'API_KEY=[비밀정보 제거]'],
    ['"client_secret": "json-secret-value"', '"client_secret": "[비밀정보 제거]"'],
    ['password: database-password', 'password: [비밀정보 제거]'],
    ['token=x', 'token=[비밀정보 제거]'],
    ['API_KEY="unterminated', 'API_KEY="[비밀정보 제거]"'],
    ['https://user:password123@example.com/db', 'https://user:[비밀정보 제거]@example.com/db'],
  ])('할당된 자격증명을 값만 가린다: %s', (input, expected) => {
    expect(redactGithubSecrets(input)).toBe(expected)
  })

  it.each([
    `ghp_${'a'.repeat(36)}`,
    `github_pat_${'a'.repeat(30)}`,
    `AKIA${'A'.repeat(16)}`,
    `AIza${'a'.repeat(35)}`,
    `sk_live_${'a'.repeat(24)}`,
    `xoxb-${'a'.repeat(20)}`,
    `eyJ${'a'.repeat(12)}.${'b'.repeat(12)}.${'c'.repeat(12)}`,
  ])('문맥 없이 노출된 알려진 토큰 형태도 가린다', (token) => {
    expect(redactGithubSecrets(`설정값 ${token} 사용`)).toBe('설정값 [비밀정보 제거] 사용')
  })

  it('개인키 블록 전체를 제거한다', () => {
    const key = '-----BEGIN RSA PRIVATE KEY-----\nsecret-lines\n-----END RSA PRIVATE KEY-----'
    expect(redactGithubSecrets(`앞\n${key}\n뒤`)).toBe('앞\n[비밀정보 제거]\n뒤')
  })

  it('일반 의존성 버전과 기술 설명은 보존한다', () => {
    const input = 'token bucket을 쓰고 next 버전은 16.2.6이다.'
    expect(redactGithubSecrets(input)).toBe(input)
  })
})
