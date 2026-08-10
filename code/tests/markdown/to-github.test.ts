import { describe, expect, it } from 'vitest'
import { toGithubMarkdown } from '@/lib/markdown/to-github'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { PENDING_NODES } from '../../data/pending-nodes'

/**
 * 해설을 GitHub이 그릴 수 있는 마크다운으로 옮긴다.
 *
 * **뜻을 잃지 않는 것이 전부다.** 도식은 모양이 아니라 순서·소속·방향·동시성을
 * 나른다. 표로만 바꾸면 그 뜻이 조용히 사라진다 — 화면은 멀쩡해 보이는데
 * 읽는 사람이 알 수 없게 된다.
 */
const conv = (body: string) => toGithubMarkdown(body)

describe('toGithubMarkdown · 울타리가 남지 않는다', () => {
  it('우리 문법이 글자로 새지 않는다', () => {
    const out = conv('답이다.\n\n:::flow\n앱 -> DB: 요청\nDB -> 앱: 응답\n:::')
    expect(out).not.toContain(':::')
  })

  /* 코퍼스 전체가 이 성질을 지켜야 레포에 넣을 수 있다 */
  it('손으로 쓴 것에도 울타리가 안 남는다', () => {
    const all = [...EXAMPLE_NODES, ...AUTHORED_NODES, ...PENDING_NODES]
    const leaked = all.filter((n) => conv(n.body).includes(':::'))
    expect(leaked.map((n) => n.question)).toEqual([])
  })
})

describe('toGithubMarkdown · 뜻이 남는가', () => {
  it('순서는 번호로 남는다', () => {
    const out = conv(':::flow\n클라 -> 서버: SYN\n서버 -> 클라: SYN-ACK\n:::')
    expect(out).toContain('1. **클라 → 서버** — SYN')
    expect(out).toContain('2. **서버 → 클라** — SYN-ACK')
  })

  /*
   * 콜아웃은 GitHub 알림 상자가 받는다. 인용으로만 옮기면 "한 번 더 세운 말"과
   * "밟기 쉬운 자리"가 같은 모양이 되어 둘을 가른 뜻이 사라진다.
   */
  it('콜아웃은 알림 상자로 남는다', () => {
    expect(conv(':::note\n요약이다.\n:::')).toBe('> [!NOTE]\n> 요약이다.')
    expect(conv(':::warn\n함정이다.\n:::')).toBe('> [!WARNING]\n> 함정이다.')
  })

  /* 빈 줄에 `>`가 없으면 둘째 문단이 상자 밖으로 떨어진다 */
  it('여러 문단이 한 상자에 남는다', () => {
    const out = conv(':::note\n첫 문단이다.\n\n둘째 문단이다.\n:::')
    expect(out).toBe('> [!NOTE]\n> 첫 문단이다.\n>\n> 둘째 문단이다.')
  })

  /* 번호를 매기면 갈림이 "그다음"으로 읽힌다. 상태는 묶어서 중첩으로 */
  it('상태의 갈림은 번호가 아니라 중첩으로 남는다', () => {
    const out = conv(':::state\n반열림 -> 닫힘: 실패\n반열림 -> 열림: 성공\n:::')
    expect(out).toContain('- **반열림**')
    expect(out).toContain('  - → **닫힘** — 실패')
    expect(out).toContain('  - → **열림** — 성공')
    expect(out).not.toMatch(/^\d+\./m)
  })

  it('트리의 소속은 들여쓰기로 남는다', () => {
    const out = conv(':::tree\n루트\n  자식 | 설명\n:::')
    expect(out).toContain('- **루트**')
    expect(out).toContain('  - **자식** — 설명')
  })

  /* 표만 두면 위아래가 주소라는 것이 통째로 사라진다 */
  it('메모리는 방향을 글로 남긴다', () => {
    const out = conv(':::memory\n스택 | 지역 변수 | 아래로\n힙 | 동적 할당 | 위로\n:::')
    expect(out).toContain('위가 높은 주소')
    expect(out).toContain('아래로 자란다')
    expect(out).toContain('위로 자란다')
  })

  /* 비어 있는 것이 기다림이다. `-`로 메우면 무언가 한 것처럼 읽힌다 */
  it('타임라인의 빈 칸을 채우지 않는다', () => {
    const out = conv(':::timeline\nA | 읽는다 |  | 쓴다\nB |  | 읽는다 | 쓴다\n:::')
    expect(out).toContain('| A | B |')
    expect(out).toContain('| 1 | 읽는다 |  |')
    expect(out).not.toContain('| - |')
  })

  it('계층은 위가 위층이라고 적는다', () => {
    const out = conv(':::stack\n응용 | HTTP\n전송 | TCP\n망 | IP\n:::')
    expect(out).toContain('위가 위층이다')
    expect(out).toContain('| 응용 | HTTP |')
  })

  it('표는 그대로 둔다', () => {
    const out = conv('가 | 나\n--- | ---\n1 | 2')
    expect(out).toContain('| 가 | 나 |')
    expect(out).toContain('| 1 | 2 |')
  })
})

describe('toGithubMarkdown · 표가 깨지지 않는다', () => {
  /*
   * 칸 안의 `|`는 표의 칸을 쪼갠다. 막지 않으면 열이 밀려 표가 통째로 어긋난다.
   *
   * `parseStack`은 **첫** `|`만 구분자로 쓰므로 설명 쪽에 파이프가 남을 수 있다.
   * 실제로 `TCP | UDP`처럼 견주는 설명이 코퍼스에 있다.
   */
  it('설명에 남은 파이프를 막는다', () => {
    const out = conv(':::stack\n전송 | TCP | UDP\n둘째 | 설명\n셋째 | 설명\n:::')
    expect(out).toContain('TCP \\| UDP')
  })
})

describe('toGithubMarkdown · 본문을 잃지 않는다', () => {
  it('문단은 그대로 남는다', () => {
    const out = conv('첫 문단이다.\n\n둘째 문단이다.')
    expect(out).toBe('첫 문단이다.\n\n둘째 문단이다.')
  })

  /* 도식 안의 이름표가 사라지면 그림 없이 뜻까지 잃는다 */
  it('도식 안의 글자가 전부 남는다', () => {
    const all = [...EXAMPLE_NODES, ...AUTHORED_NODES]
    for (const n of all) {
      const out = conv(n.body)
      const words = n.body
        .split('\n')
        .filter((l) => !l.trim().startsWith(':::'))
        /* `:`도 구분자다. `프록시 -> 대상: 라벨`의 콜론은 내용이 아니다 */
        .flatMap((l) => l.split(/[|:\->→\s]+/))
        .filter((w) => w.length >= 4 && /[가-힣]/.test(w))
      const missing = words.filter((w) => !out.includes(w))
      expect({ q: n.question, missing }).toEqual({ q: n.question, missing: [] })
    }
  })
})
