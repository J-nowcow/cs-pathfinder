import { describe, expect, it } from 'vitest'
import { parseGithubRepo } from '@/lib/personalize/github-source'

describe('GitHub 공개 레포 입력', () => {
  it('레포 주소를 owner와 repo로 나눈다', () => {
    expect(parseGithubRepo('https://github.com/openai/openai-cookbook')).toEqual({
      ok: true,
      value: {
        owner: 'openai',
        repo: 'openai-cookbook',
        canonicalUrl: 'https://github.com/openai/openai-cookbook',
      },
    })
  })

  it('붙여넣기 쉬운 주소와 git 접미사를 정규화한다', () => {
    expect(parseGithubRepo(' github.com/J-nowcow/cs-pathfinder.git/ ')).toEqual({
      ok: true,
      value: {
        owner: 'J-nowcow',
        repo: 'cs-pathfinder',
        canonicalUrl: 'https://github.com/J-nowcow/cs-pathfinder',
      },
    })
  })

  it.each([
    'https://github.com.evil.example/openai/openai-cookbook',
    'https://evil.example/github.com/openai/openai-cookbook',
    'http://github.com/openai/openai-cookbook',
  ])('GitHub가 아닌 요청 대상은 거부한다: %s', (url) => {
    const result = parseGithubRepo(url)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unsupported_host')
  })

  it.each([
    'https://github.com/openai/openai-cookbook/tree/main',
    'https://github.com/openai/openai-cookbook/blob/main/README.md',
    'https://github.com/openai',
  ])('레포 루트가 아닌 주소는 거부한다: %s', (url) => {
    const result = parseGithubRepo(url)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('not_repository')
  })

  it('URL 인증정보를 허용하지 않는다', () => {
    const result = parseGithubRepo('https://user:token@github.com/openai/openai-cookbook')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid_url')
  })
})
