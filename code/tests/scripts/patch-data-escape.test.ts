import { describe, it, expect } from 'vitest'
import { escapeForData } from '../../scripts/lib/patch-data'

/**
 * 교정 도구가 **찾을 수 있게** 문자를 바꾸는가.
 *
 * 본문은 정적 파일에 한 줄짜리 문자열로 들어 있다. 값이 `$\rightarrow$`이면
 * 파일에는 `$\\rightarrow$`로 적힌다. 줄바꿈만 바꿔 찾으면 안 나오고,
 * 도구는 **"그런 문장이 없다"고 답한다.**
 *
 * 그게 무서운 이유는 조용하기 때문이다. 교정이 안 들어갔는데 시험도 관문도
 * 통과한다. 실제로 도식 하나를 그렇게 놓쳤다.
 */
describe('교정 도구의 문자 바꾸기', () => {
  it('줄바꿈을 막는다', () => {
    expect(escapeForData('a\nb')).toBe('a\\nb')
  })

  /* 이것이 없어서 `$\rightarrow$`가 든 표 칸을 못 찾았다 */
  it('역슬래시를 막는다', () => {
    expect(escapeForData('$\\rightarrow$')).toBe('$\\\\rightarrow$')
  })

  it('큰따옴표를 막는다', () => {
    expect(escapeForData('그는 "안녕"이라 했다')).toBe('그는 \\"안녕\\"이라 했다')
  })

  /*
   * 순서가 중요하다. 역슬래시를 나중에 바꾸면 앞서 넣은 `\n`의 역슬래시까지
   * 다시 바뀌어 `\\n`이 된다. 그러면 줄바꿈이 든 문장을 또 못 찾는다.
   */
  it('줄바꿈을 바꾼 뒤 그 역슬래시를 다시 바꾸지 않는다', () => {
    expect(escapeForData('a\nb')).not.toContain('\\\\n')
  })

  it('바꿀 것이 없으면 그대로 둔다', () => {
    expect(escapeForData('평범한 문장이다')).toBe('평범한 문장이다')
  })
})
