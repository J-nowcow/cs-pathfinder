import { GLOSSARY } from '../../../data/glossary'
import type { InlineToken } from '@/lib/markdown/inline'

/**
 * 본문 속 용어의 **첫 등장**에 사전 링크를 단다.
 *
 * 함정 넷을 하나씩 막는다.
 *
 * ① 도배 — 같은 용어가 본문에 수십 번 나온다. `seen`을 본문 단위로
 *    공유해 첫 등장만 잇는다. 링크투성이 문단은 안 읽힌다.
 * ② 도식 오염 — 여기는 문단의 인라인 토큰만 받는다. 도식은 파서가
 *    별도 블록으로 갈라 두므로 **구조적으로** 닿지 않는다.
 * ③ 부분 문자열 — `GC`가 `GCC`에, `스택`이 `스택오버플로`에 걸리면
 *    안 된다. 앞뒤 경계를 본다.
 * ④ 조사 — `스레드는`에서 `스레드`를 잡아야 한다. **여기서 욕심내면
 *    낱말 겹침 매칭의 실패를 반복한다.** 조사를 정확히 열거하고 그
 *    밖의 한글 이어짐은 전부 합성어로 보고 잇지 않는다. 형태소 분석은
 *    안 붙인다.
 *
 * `text` 토큰만 만진다. `code`는 코드라서, `bold`는 강조라서 두는 것이
 * 아니라 — 마크업 안에 링크를 끼우면 토큰이 중첩되는데 그 복잡성이
 * 첫판에 값을 못 한다. 놓친 등장은 다음 문단의 같은 용어가 잡는다.
 */

export type LinkedToken = InlineToken | { type: 'term'; value: string; term: string; short: string }

/**
 * 용어 뒤에 붙어도 되는 조사. 이 밖의 한글이 이어지면 합성어다.
 *
 * `relations/shortlist.ts`의 조사 목록과 겹치지만 합치지 않는다 —
 * 그쪽은 낱말을 "벗기는" 목록이고 여기는 경계를 "허용하는" 목록이라,
 * 한쪽 요구로 목록을 고치면 다른 쪽이 조용히 바뀐다.
 */
const PARTICLES = new Set([
  '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '만', '로', '으로',
  '에서', '에서는', '에게', '까지', '부터', '보다', '처럼', '마다', '라는', '이라는',
  '란', '이란', '나', '이나', '든', '이든',
])

const HANGUL = /[가-힣]/
const ALNUM = /[A-Za-z0-9]/

/** 긴 용어 먼저. `컨텍스트 스위칭`이 `스택`보다 먼저 잡혀야 한다 */
const TERMS = [...GLOSSARY].sort((a, b) => b.term.length - a.term.length)

function boundaryOk(text: string, start: number, end: number): boolean {
  const prev = start > 0 ? text[start - 1] : ''
  if (prev && (ALNUM.test(prev) || HANGUL.test(prev))) return false

  const next = end < text.length ? text[end] : ''
  if (!next) return true
  if (ALNUM.test(next)) return false
  if (!HANGUL.test(next)) return true

  /* 한글이 이어진다. 조사면 허용, 아니면 합성어다 */
  let run = ''
  for (let i = end; i < text.length && HANGUL.test(text[i]); i += 1) run += text[i]
  return PARTICLES.has(run)
}

/**
 * 문단 하나의 토큰을 받아 용어 토큰을 끼워 넣는다.
 *
 * `seen`은 **본문 단위**로 호출자가 만들어 넘긴다. 문단마다 새로 만들면
 * 문단 수만큼 같은 링크가 생긴다 — ①이 무너진다.
 */
export function linkifyTokens(tokens: InlineToken[], seen: Set<string>): LinkedToken[] {
  const out: LinkedToken[] = []

  for (const t of tokens) {
    if (t.type !== 'text') {
      out.push(t)
      continue
    }

    let text = t.value
    let emitted = false
    /*
     * 한 텍스트 토큰에서 여러 용어를 잡을 수 있다. 앞에서부터 자르며
     * 진행한다. 용어 목록이 25개라 이중 루프여도 문단당 비용이 작다.
     */
    while (text.length > 0) {
      let hit: { at: number; entry: (typeof TERMS)[number] } | null = null
      for (const entry of TERMS) {
        if (seen.has(entry.term)) continue
        /*
         * 첫 등장이 경계에 막혀도 뒤를 계속 본다. "스택오버플로는 스택이
         * 넘친 것"에서 첫 `스택`(합성어)에 막히고 멈추면 진짜 등장을
         * 영영 놓친다.
         */
        let at = text.indexOf(entry.term)
        while (at !== -1 && !boundaryOk(text, at, at + entry.term.length)) {
          at = text.indexOf(entry.term, at + 1)
        }
        if (at === -1) continue
        if (!hit || at < hit.at || (at === hit.at && entry.term.length > hit.entry.term.length)) {
          hit = { at, entry }
        }
      }
      if (!hit) break

      seen.add(hit.entry.term)
      if (hit.at > 0) out.push({ type: 'text', value: text.slice(0, hit.at) })
      out.push({ type: 'term', value: hit.entry.term, term: hit.entry.term, short: hit.entry.short })
      text = text.slice(hit.at + hit.entry.term.length)
      emitted = true
    }

    if (text.length > 0 || !emitted) out.push({ type: 'text', value: text })
  }

  return out
}
