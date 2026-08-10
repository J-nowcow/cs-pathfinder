import { GLOSSARY, type GlossaryEntry } from '../../../data/glossary'

/**
 * 사전 페이지의 순수 계산 — 초성, 정렬, 검색, 구간 나누기.
 *
 * 컴포넌트에서 떼어 둔다. 목록이 75개로 늘면서 "ㅅ으로 시작하는 것"을 찾는
 * 일이 생겼는데, 그 판정을 화면 코드 안에 두면 시험할 길이 없다.
 *
 * **앵커는 여기서 만들지 않는다.** 본문 링크가 `#${encodeURIComponent(term)}`로
 * 오고 페이지는 `id={term}`로 받는다. 이미 나가 있는 규약이라 손대면 본문
 * 링크가 통째로 죽는다. 구간 머리글만 새 id(`초성-ㄱ`)를 쓴다 — 용어와
 * 겹칠 수 없는 이름이다.
 */

/** 유니코드 한글 음절 첫 글자 */
const HANGUL_BASE = 0xac00
/** 한 초성이 거느리는 음절 수 (중성 21 × 종성 28) */
const PER_CHO = 588

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

/**
 * 된소리는 예사소리 칸에 함께 넣는다.
 *
 * 사전 순서로는 ㄲ이 ㄱ과 별개지만, 인덱스 바는 **찾는 도구**다. 칸이
 * 19개로 늘면 폰에서 두 줄이 되고, ㄲ 칸에 한 항목만 들어 있으면 누를
 * 이유도 없다. 지금 목록에 된소리로 시작하는 용어는 없지만 나중에
 * 생겨도 조용히 ㄱ에 붙는다.
 */
const FOLD: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' }

/** 영문은 한 칸으로 모은다. A~Z를 다 세우면 인덱스 바가 목록보다 길어진다 */
export const LATIN_BUCKET = 'A'
/** 숫자·기호로 시작하는 것. 지금은 비어 있지만 들어와도 떨어뜨리지 않는다 */
export const OTHER_BUCKET = '#'

/** 인덱스 바에 세우는 순서. 여기 없는 칸은 만들지 않는다 */
export const BUCKET_ORDER = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
  LATIN_BUCKET,
  OTHER_BUCKET,
] as const

/**
 * 용어가 어느 칸에 속하는가.
 *
 * 자모를 표로 들고 있지 않고 코드포인트에서 계산한다 — 한글 음절은
 * `초성 × 588 + 중성 × 28 + 종성` 규칙으로 배열돼 있어서 나눗셈 한 번이면
 * 나온다.
 */
export function initialOf(term: string): string {
  const ch = term.charCodeAt(0)

  const offset = ch - HANGUL_BASE
  if (offset >= 0 && offset < CHOSUNG.length * PER_CHO) {
    const cho = CHOSUNG[Math.floor(offset / PER_CHO)]
    return FOLD[cho] ?? cho
  }

  if (/[A-Za-z]/.test(term[0])) return LATIN_BUCKET
  return OTHER_BUCKET
}

/** 한글 먼저, 영문은 뒤에. 같은 갈래 안에서는 가나다·알파벳순 */
function rank(term: string): number {
  const bucket = initialOf(term)
  if (bucket === OTHER_BUCKET) return 2
  if (bucket === LATIN_BUCKET) return 1
  return 0
}

export function sortEntries(entries: readonly GlossaryEntry[]): GlossaryEntry[] {
  return [...entries].sort(
    (a, b) => rank(a.term) - rank(b.term) || a.term.localeCompare(b.term, 'ko'),
  )
}

/**
 * 검색. 용어와 뜻을 함께 본다.
 *
 * 뜻까지 보는 이유 — 이름을 모르니까 찾는다. "메모리를 회수"로 GC에
 * 닿을 수 있어야 사전 노릇을 한다.
 *
 * 대소문자를 접는다. `tcp`로 쳐서 `TCP`가 안 나오면 고장으로 보인다.
 */
export function filterEntries(entries: readonly GlossaryEntry[], query: string): GlossaryEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...entries]
  return entries.filter(
    (e) => e.term.toLowerCase().includes(q) || e.short.toLowerCase().includes(q),
  )
}

export type Group = { initial: string; entries: GlossaryEntry[] }

/**
 * 정렬된 목록을 초성 구간으로 나눈다.
 *
 * **비어 있는 칸은 만들지 않는다.** 검색으로 걸러진 뒤에도 이 함수를 다시
 * 태우므로, 결과에 없는 초성은 인덱스 바에서도 저절로 사라진다.
 */
export function groupByInitial(entries: readonly GlossaryEntry[]): Group[] {
  const sorted = sortEntries(entries)
  const groups: Group[] = []

  for (const entry of sorted) {
    const initial = initialOf(entry.term)
    const last = groups.at(-1)
    if (last?.initial === initial) last.entries.push(entry)
    else groups.push({ initial, entries: [entry] })
  }

  return groups
}

/** 구간 머리글의 id. 용어 앵커(`id={term}`)와 겹치지 않는 이름이어야 한다 */
export function groupAnchor(initial: string): string {
  return `초성-${initial}`
}

export const ALL_ENTRIES = sortEntries(GLOSSARY)
