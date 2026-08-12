import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 게시판 카테고리 칩이 화면 밖으로 숨지 않는가.
 *
 * 어느 폭에서든 가로로 밀게 해뒀다. 1280px에서 재보니 칩 줄이 1062px인데 담는
 * 자리가 704px이라 **358px이 잘려 있었다** — 프론트엔드·인프라 · 보안·모바일
 * 셋이 안 보였다. `.scroll-x`가 스크롤바를 감추므로 더 있다는 표시가 아무것도
 * 없었다. 좌우로 288px씩 비어 있는 화면에서 셋을 숨기고 있던 셈이다.
 *
 * 넘침·줄수는 브라우저가 계산하는 것이라 happy-dom에서 재현되지 않는다.
 * 여기서는 그 뜻을 담은 클래스가 남아 있는지만 지킨다. 진짜 확인은 브라우저에서
 * `scrollWidth - clientWidth`가 0인지 보는 것이다(고친 뒤 1280px에서 0, 칩
 * 11개 전부 보임, 2줄).
 */
const src = readFileSync(new URL('../../src/components/Board.tsx', import.meta.url), 'utf8')
const chipRow = src.match(/<div\s+className="flex w-max[^"]*"/)?.[0] ?? ''

describe('게시판 카테고리 칩', () => {
  it('정렬과 카테고리의 선택 상태를 화면 낭독기에 알린다', () => {
    expect(src).toContain('role="group" aria-label="정렬"')
    expect(src).toContain('aria-label="카테고리"')
    expect(src).toContain('aria-pressed={sort === s.value}')
    expect(src).toContain('aria-pressed={category === null}')
    expect(src).toContain('aria-pressed={category === c}')
  })

  it('넓은 화면에서는 줄을 바꿔 전부 보여준다', () => {
    expect(chipRow).toContain('sm:flex-wrap')
    expect(chipRow).toContain('sm:w-auto')
  })

  /* 줄을 바꾸면 칩만 세 줄이 되어 정작 트리 카드가 화면 밖으로 밀린다 */
  it('폰에서는 가로로 민다', () => {
    expect(chipRow).toContain('w-max')
    expect(src).toContain('scroll-x')
  })

  /* 밀 수 있다는 것을 알려야 한다. 스크롤바가 감춰져 있어 단서가 없었다 */
  it('폰에서 오른쪽 끝을 흐리게 해 더 있다고 알린다', () => {
    expect(src).toMatch(/bg-gradient-to-l[^"]*sm:hidden/)
  })

  it('목록과 더 보기 버튼이 불러오는 상태를 알린다', () => {
    expect(src).toContain('aria-busy={loading || undefined}')
    expect(src).toContain('animate-spin')
  })
})
