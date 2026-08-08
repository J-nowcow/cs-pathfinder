import { readFileSync, writeFileSync } from 'node:fs'

/**
 * 본문을 고칠 때 **정적 파일이 진짜 출처다.**
 *
 * `bootstrap.ts`가 이 파일들에서 `qnode.body`를 덮어쓴다. 주석에 그렇게 적혀
 * 있다 -- "본문은 이 파일이 단일 출처인 저작 콘텐츠라 고치면 화면에 반영돼야
 * 한다". 그래서 **DB만 고치면 조용히 되돌아간다.** 배포를 안 해도 된다.
 * 살아 있는 사이트에 요청 하나만 들어오면 그때 복구된다.
 *
 * 실제로 당했다. 도식 34편을 고쳤는데 넷이 원래대로 돌아가 있었다. 그 넷은
 * `generated-nodes.ts`가 아니라 `example-nodes.ts`에 살던 것이었고, 도구가
 * 그 파일을 안 봤다.
 *
 * 그래서 **네 파일을 다 뒤진다.** 한 곳에서 찾으면 거기 고치고, 어디에도
 * 없으면 그렇다고 알린다 -- 조용히 넘어가면 다음에 또 당한다.
 */
const DATA_FILES = [
  'data/generated-nodes.ts',
  'data/example-nodes.ts',
  'data/authored-nodes.ts',
  'data/pending-nodes.ts',
]

/** 정적 파일에는 본문이 한 줄짜리 JSON 문자열로 들어 있다 */
export function escapeForData(s: string): string {
  return s.replace(/\n/g, '\\n')
}

export type PatchResult =
  | { ok: true; file: string; form: 'escaped' | 'lines' }
  | { ok: false; reason: 'not-found' | 'ambiguous'; hits: string[] }

/** 정규식에서 뜻을 갖는 글자를 막는다 */
function rx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 본문을 **줄 배열**로 담은 파일도 있다.
 *
 * `generated-nodes.ts`는 한 줄짜리 문자열에 `\n`을 박아 넣는데,
 * `example-nodes.ts`는 이렇게 쓴다.
 *
 * ```
 * [
 *   ':::stack',
 *   '상호 배제 | 자원을 한 번에 하나만 쓸 수 있다',
 *   ':::',
 * ].join('\n'),
 * ```
 *
 * 그래서 `\n`으로 이은 글자를 찾으면 영영 못 만난다. 실제로 못 만났고,
 * 그 탓에 네 편이 조용히 되돌아갔다.
 *
 * 줄마다 따옴표를 벗겨 맞춰 보고, 맞으면 같은 들여쓰기로 다시 싼다.
 */
function patchLineArray(text: string, before: string, after: string): string | null {
  const lines = before.split('\n')
  /* `'줄',` 이 줄바꿈과 들여쓰기로 이어진 모양 */
  const pattern = lines.map((l) => `(['"])${rx(l)}\\1,`).join('\\s*\\n\\s*')
  const re = new RegExp(pattern, 'g')

  const found = [...text.matchAll(re)]
  if (found.length !== 1) return null

  const at = found[0].index!
  /* 앞줄의 들여쓰기를 그대로 쓴다 */
  const lineStart = text.lastIndexOf('\n', at) + 1
  const indent = text.slice(lineStart, at)
  const quote = found[0][1]

  const replaced = after
    .split('\n')
    .map((l) => `${quote}${l}${quote},`)
    .join('\n' + indent)

  return text.slice(0, at) + replaced + text.slice(at + found[0][0].length)
}

/**
 * 네 파일 중 `before`가 든 곳을 찾아 `after`로 바꾼다.
 *
 * 두 파일에 걸쳐 있으면 **고르지 않고 멈춘다.** 어느 쪽이 화면에 나가는지
 * 모르는 채 하나만 고치면 반은 옛 글로 남는다.
 */
export function patchDataFiles(before: string, after: string): PatchResult {
  const from = escapeForData(before)
  const hits: Array<{ file: string; form: 'escaped' | 'lines'; next: string }> = []

  for (const f of DATA_FILES) {
    let s: string
    try {
      s = readFileSync(f, 'utf8')
    } catch {
      continue
    }

    if (s.includes(from)) {
      hits.push({ file: f, form: 'escaped', next: s.replace(from, escapeForData(after)) })
      continue
    }
    const asLines = patchLineArray(s, before, after)
    if (asLines) hits.push({ file: f, form: 'lines', next: asLines })
  }

  if (hits.length === 0) return { ok: false, reason: 'not-found', hits: [] }
  if (hits.length > 1) return { ok: false, reason: 'ambiguous', hits: hits.map((h) => h.file) }

  writeFileSync(hits[0].file, hits[0].next)
  return { ok: true, file: hits[0].file, form: hits[0].form }
}
