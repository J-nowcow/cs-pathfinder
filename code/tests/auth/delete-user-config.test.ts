import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

/**
 * **탈퇴가 실제로 켜져 있다는 것을 고정한다.**
 *
 * 두 설정 다 없으면 화면은 멀쩡한데 프로덕션에서만 실패한다 —
 * `deleteUser`를 안 켜면 `/delete-user`가 404고, `freshAge`를 안 낮추면
 * 오래된 세션이 SESSION_EXPIRED로 막힌다. 둘 다 "설정 한 줄"이라
 * 정리하다 조용히 지워지기 쉽고, 지워져도 이 저장소 안에서는
 * 아무 시험도 빨개지지 않는다. 그 되돌림을 여기서 잡는다.
 *
 * 소스 문자열을 읽는 이유는 `collect-nothing.test.ts`와 같다 —
 * 테스트 DB(PGlite)에는 pg.Pool이 없어 betterAuth 인스턴스를 못 만든다.
 */
const src = readFileSync(resolve(__dirname, '../../src/lib/auth/index.ts'), 'utf8')

describe('탈퇴 설정 — 배선', () => {
  it('deleteUser가 켜져 있다 — 끄면 엔드포인트가 404다', () => {
    // user 블록만 잘라 본다. 주석에 적힌 단어에 속지 않게
    const userBlock = src.slice(src.indexOf('deleteUser'))
    expect(src).toContain('deleteUser')
    expect(userBlock).toMatch(/enabled:\s*true/)
  })

  /*
   * 구글 로그인만 있어서 비밀번호가 없다. 비밀번호 재확인 경로가 없는 계정에는
   * 세션 신선도 검사가 "다시 인증하라"가 아니라 그냥 막다른 길이 된다.
   */
  it('세션 신선도 검사가 꺼져 있다 — 켜두면 오래된 세션이 탈퇴하지 못한다', () => {
    expect(src).toMatch(/freshAge:\s*0/)
  })

  /*
   * 왜 껐는지가 코드 옆에 없으면, 다음 사람은 이것을 실수로 읽고 되돌린다.
   * 민감 작업이 늘면 재검토해야 한다는 사실도 같이 남아 있어야 한다.
   */
  it('신선도를 끈 이유가 주석으로 남아 있다', () => {
    expect(src).toContain('재검토')
  })
})
