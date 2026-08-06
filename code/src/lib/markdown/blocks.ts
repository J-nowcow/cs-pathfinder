/**
 * 해설 본문의 블록 분해.
 *
 * 통짜 문단만 있으면 순서도 구조도 비교도 전부 줄글로 읽어야 한다. 3-way
 * handshake처럼 순서가 본질인 내용이 특히 손해다.
 *
 * **HTML을 만들지 않는다.** 구조만 돌려주고 렌더러가 React 요소로 바꾼다.
 * Mermaid 같은 도구는 SVG 문자열을 innerHTML로 넣어야 하는데, 자유 입력이 전역
 * 자산이 되는 구조라 그 경로를 아예 두지 않는 편이 정화보다 확실하다.
 * 덤으로 도식이 사이트 디자인과 같은 색·같은 글꼴로 그려진다.
 *
 * **깨진 블록은 문단으로 떨어뜨린다.** 모델이 문법을 조금 틀렸다고 해설이
 * 빈 화면이 되면 안 된다. 파서는 절대 던지지 않는다.
 */

export type Block =
  | { type: 'paragraph'; text: string }
  /** 행위자 사이의 순서. 3-way handshake 같은 것 */
  | { type: 'flow'; steps: FlowStep[] }
  /** 같은 것이 상태를 바꾸며 돌아오거나 갈라질 때. 문법은 flow와 같다 */
  | { type: 'state'; steps: FlowStep[] }
  /** 무엇이 무엇에 속하는가. B-tree·상속·참조 사슬 같은 것 */
  | { type: 'tree'; nodes: TreeNode[] }
  /** 어디에 놓이고 어느 쪽으로 자라는가. 주소 공간·스택과 힙 같은 것 */
  | { type: 'memory'; areas: MemoryArea[] }
  /** 누가 같은 시간에 무엇을 하는가. 경쟁 상태·블로킹 같은 것 */
  | { type: 'timeline'; rows: TimelineRow[] }
  /** 위에서 아래로 쌓이는 계층. OSI, 메모리 영역 같은 것 */
  | { type: 'stack'; layers: StackLayer[] }
  /** 열 비교. 낙관적 락 대 비관적 락 같은 것 */
  | { type: 'table'; head: string[]; rows: string[][] }

export type FlowStep = { from: string; to: string; label: string }
export type StackLayer = { name: string; note: string }
export type TreeNode = { depth: number; name: string; note: string }
export type MemoryArea = { name: string; note: string; grow: 'up' | 'down' | null }
export type TimelineRow = { actor: string; slots: string[] }

/**
 * 울타리 인식은 넉넉하게 잡는다.
 *
 * 모델은 매번 조금씩 다르게 쓴다. `:::flow` 뒤에 설명을 붙이거나 `::: flow`로
 * 띄우거나 닫을 때 `:::end`라고 적는다. 엄격하게 보면 그때마다 도식이 통째로
 * 문단이 되고, 사용자 화면에 `:::` 기호가 그대로 뜬다.
 *
 * 실측에서 세 번 중 두 번은 정확했고 한 번은 이런 변형이었다.
 */
const FENCE_OPEN = /^:::\s*(flow|state|tree|memory|timeline|stack)\b/
const FENCE_CLOSE = /^:::\s*(end)?\s*$/

/**
 * 도식 기호가 본문에 새는 것을 막는 마지막 그물.
 *
 * 어떤 이유로든 못 알아본 울타리가 문단에 남으면 `:::`가 화면에 그대로 보인다.
 * 도식을 못 그린 것은 아쉬운 정도지만 기호가 보이는 것은 고장으로 읽힌다.
 * 코드 울타리도 같이 턴다 — 모델이 도식을 ``` 로 감싸는 경우가 있다.
 *
 * 그물이 둘이다. 울타리만 있는 줄은 통째로 버리고, 문장 중간에 섞인 기호는
 * 그 자리만 지운다. 줄 시작만 보면 "…이다. :::flow" 같은 모양이 빠져나간다.
 */
const FENCE_ONLY_LINE = /^\s*(:::|```)/
const INLINE_FENCE = /:::\s*(flow|state|tree|memory|timeline|stack|end)?|```+[a-z]*/g

/**
 * `클라이언트 -> 서버: SYN` 또는 `클라이언트 → 서버: SYN`
 *
 * **설명은 없어도 된다.** 전에는 `: 설명`을 반드시 요구했는데, 그 탓에
 * `데이터 분할 -> 런 생성 -> 병합`처럼 화살표만 있는 줄이 통째로 문단이 됐다.
 * 화살표는 그것 하나로 이미 "이 다음 저것"을 말한다 — 설명이 없다고 순서가
 * 아닌 것은 아니다. 운영 중인 해설 하나가 이 이유로 도식을 잃고 있었다.
 *
 * 콜론이 이름 안에 있는 경우와 헷갈리지 않게 **화살표 뒤쪽에서만** 자른다.
 */
const FLOW_LINE = /^(.+?)\s*(?:->|→|=>)\s*(.+?)(?:\s*:\s*(.+))?$/

/** `전송 계층 | TCP, UDP` — 오른쪽 설명은 없어도 된다 */
const STACK_LINE = /^(.+?)(?:\s*\|\s*(.*))?$/

/**
 * 한 줄에 화살표가 여러 개인 것을 여러 단계로 편다.
 *
 * 규칙은 한 줄에 한 걸음인데 모델이 이렇게 쓸 때가 있다.
 *
 *   루트 -> 'a' 노드 -> 'b' 노드 -> 'c' 노드: 'abc' 검색 완료
 *
 * 정규식이 첫 화살표에서 끊으므로 받는 쪽에 나머지 사슬이 통째로 들어간다.
 * 화면에는 한 단계짜리 순서 도식이 그려지고, 단계가 하나면 순서가 아니다.
 *
 * 실제로 생성분 219개 중 둘이 이 모양이었다. 버리는 대신 편다 — 모델이
 * 쓴 것은 사슬이 맞고 표기만 우리 규칙과 달랐다.
 *
 * 이름표는 마지막 걸음에만 붙인다. 중간 걸음에 같은 말을 반복하면 도식이
 * 아니라 같은 문장의 나열이 된다.
 */
function expandChain(from: string, rest: string, label: string): FlowStep[] {
  const hops = rest
    .split(/\s*(?:->|→|=>)\s*/)
    .map((h) => h.trim())
    .filter((h) => h.length > 0)
  if (hops.length === 0) return []

  const nodes = [from.trim(), ...hops]
  const steps: FlowStep[] = []
  for (let i = 0; i < nodes.length - 1; i += 1) {
    steps.push({
      from: nodes[i],
      to: nodes[i + 1],
      label: i === nodes.length - 2 ? label : '',
    })
  }
  return steps
}

function parseFlow(lines: string[]): Block | null {
  const steps: FlowStep[] = []
  for (const line of lines) {
    const m = FLOW_LINE.exec(line.trim())
    if (!m) return null
    steps.push(...expandChain(m[1], m[2], (m[3] ?? '').trim()))
  }
  return steps.length > 0 ? { type: 'flow', steps } : null
}

/**
 * 상태 전이.
 *
 * **문법이 `flow`와 완전히 같다.** 모델이 배울 것이 없다 — 이미 이 문법으로
 * 상태 머신을 쓰고 있었는데 그것이 `flow`로 그려지고 있었을 뿐이다.
 * 바뀌는 것은 울타리 이름과 그리는 방식뿐이다.
 *
 * 다만 전이가 하나뿐이면 상태 머신이 아니다. `A -> B` 한 줄은 그냥 순서다.
 * 그때는 `null`을 돌려 문단으로 떨어뜨린다 — 억지로 상태로 그리면 "상태가
 * 둘 있다"는 없는 뜻이 생긴다.
 */
function parseState(lines: string[]): Block | null {
  const flow = parseFlow(lines)
  if (!flow || flow.type !== 'flow' || flow.steps.length < 2) return null
  return { type: 'state', steps: flow.steps }
}

/** 깊이가 이보다 깊어지면 눌러 그린다. 폰에서 왼쪽 여백만 늘고 이름 칸이 사라진다 */
const MAX_TREE_DEPTH = 3

/**
 * 무엇이 무엇에 속하는가.
 *
 * `stack`의 `이름 | 설명`에 들여쓰기를 더한 것이다. 계층과 다르다 — 계층은
 * 위아래로 쌓인 것이고 트리는 **속한 것**이다. B-tree·상속·참조 사슬·인증서
 * 체인이 여기 온다. 지금은 그런 것들이 전부 stack으로 그려져 있다.
 *
 * **들여쓰기 관용이 이 문법의 전부다.** 모델은 2칸·4칸·탭·`-` 불릿을 섞어
 * 쓴다. 그래서 깊이를 절대값으로 읽지 않는다. 나온 들여쓰기 폭을 모아
 * 정렬한 뒤 0·1·2로 다시 매긴다. 2칸이든 4칸이든 탭이든 같은 트리가 나온다.
 */
function parseTree(lines: string[]): Block | null {
  type Raw = { indent: number; name: string; note: string }
  const raws: Raw[] = []

  for (const line of lines) {
    // 탭은 두 칸으로 친다. 불릿은 떼되 그 자리도 들여쓰기로 센다
    const expanded = line.replace(/\t/g, '  ')
    const m = /^(\s*)(?:[-*]\s+)?(.*)$/.exec(expanded)
    if (!m) return null

    const rest = m[2].trim()
    if (rest.length === 0) return null

    const cut = rest.indexOf('|')
    raws.push({
      indent: expanded.length - expanded.trimStart().length,
      name: (cut < 0 ? rest : rest.slice(0, cut)).trim(),
      note: cut < 0 ? '' : rest.slice(cut + 1).trim(),
    })
  }

  // 줄이 하나뿐이면 트리가 아니다
  if (raws.length < 2) return null
  // 첫 줄이 들여쓰기되어 있으면 뿌리가 없다
  if (raws[0].indent !== 0) return null
  if (raws.some((r) => r.name.length === 0)) return null

  const widths = [...new Set(raws.map((r) => r.indent))].sort((a, b) => a - b)
  const nodes: TreeNode[] = []
  let prev = 0

  for (const r of raws) {
    const level = widths.indexOf(r.indent)
    // 한 번에 두 단계를 뛰면 어디에 속하는지 알 수 없다
    if (level > prev + 1) return null
    prev = level
    /*
     * 깊이가 넘치면 눌러 그린다. `null`을 돌리지 않는다 — 눌린 자리는
     * 형제로 보이지만 도식을 통째로 잃는 것보다 낫다.
     */
    nodes.push({ depth: Math.min(level, MAX_TREE_DEPTH - 1), name: r.name, note: r.note })
  }

  return { type: 'tree', nodes }
}

/** 폰에서 못 읽는 크기. 넘으면 도식이 아니라 표다 */
const MAX_ACTORS = 3
const MAX_SLOTS = 5

/**
 * 누가 같은 시간에 무엇을 하는가.
 *
 * 한 줄이 한 주체, `|`로 나뉜 칸이 시간이다. 경쟁 상태·블로킹과 논블로킹처럼
 * **둘이 같은 시간에 무엇을 하는가**가 답인 자리에 쓴다.
 *
 * **빈 칸이 뜻이다.** 아무것도 안 하는 칸을 비워 두면 그것이 기다림이고,
 * 두 주체의 칸이 같은 줄에 차 있으면 그것이 겹침이다. 순서 도식으로 그리면
 * 그 둘이 시간 순서로 눕혀져 "동시에"가 사라진다.
 *
 * 줄마다 칸 수가 다르면 긴 쪽에 맞춰 채운다. 모델이 끝의 빈 칸을 자주
 * 빠뜨리는데 그때마다 도식을 잃는 것은 과하다.
 */
function parseTimeline(lines: string[]): Block | null {
  const rows: TimelineRow[] = []
  let width = 0

  for (const line of lines) {
    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim())

    const [actor, ...slots] = cells
    if (!actor || actor.length === 0) return null
    // 칸이 하나면 시간이 아니다
    if (slots.length < 2) return null

    width = Math.max(width, slots.length)
    rows.push({ actor, slots })
  }

  if (rows.length < 2 || rows.length > MAX_ACTORS) return null
  if (width > MAX_SLOTS) return null

  for (const r of rows) {
    while (r.slots.length < width) r.slots.push('')
  }

  return { type: 'timeline', rows }
}

/** 자라는 방향. 이 둘 말고는 안 받는다 */
const GROW = ['위로', '아래로'] as const

/**
 * 어디에 놓이고 어느 쪽으로 자라는가.
 *
 * 계층과 붙어 있는 것으로 구별한다. 계층은 층마다 떠 있지만 메모리는
 * **연속한 공간**이라는 것이 뜻이라 칸을 붙여 그린다.
 *
 * `stack`의 `이름 | 설명`에 선택 칸 하나를 더한다. 세 번째 칸은 `위로`나
 * `아래로`만 받는다. 그 외 값이면 `null`이라 stack과 갈린다 — 이 조건이
 * 없으면 `parseStack`처럼 무엇이든 받아 도피처가 된다.
 *
 * **마주 자라는 것이 이 도식의 존재 이유다.** 스택은 아래로, 힙은 위로
 * 자라고 그 사이가 빈 공간이다. 계층으로 그리면 그 사실이 통째로 사라진다.
 */
function parseMemory(lines: string[]): Block | null {
  const areas: MemoryArea[] = []

  for (const line of lines) {
    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim())

    if (cells.length > 3) return null
    if (cells[0].length === 0) return null

    const grow = cells[2] ?? ''
    if (grow.length > 0 && !GROW.includes(grow as (typeof GROW)[number])) return null

    areas.push({
      name: cells[0],
      note: cells[1] ?? '',
      grow: grow === '위로' ? 'up' : grow === '아래로' ? 'down' : null,
    })
  }

  // 칸이 하나뿐이면 공간을 나눈 것이 아니다
  return areas.length >= 2 ? { type: 'memory', areas } : null
}

function parseStack(lines: string[]): Block | null {
  /*
   * 울타리 안에 표가 들어온 경우.
   *
   * `stack`은 무엇이든 받는다 — 그것이 이 도식의 쓸모이자 함정이다. 모델이
   * 형태를 못 고르면 stack 울타리에 표를 통째로 넣는데, 그러면 구분줄
   * `--- | ---`이 **이름이 `---`이고 설명이 `---`인 층으로 화면에 그려진다.**
   * 운영 중인 해설 276편 가운데 둘이 지금 그 모습으로 나가 있다.
   *
   * 검사기에 `표를계층에` 규칙이 이미 있지만 그것은 **앞으로 만들** 것만
   * 막는다. 이미 저장된 본문은 다시 부르지 않으므로 영원히 깨진 채 남는다.
   * 파서가 알아보면 글은 그대로 두고 화면만 고쳐진다.
   *
   * 구분줄이 보이면 표로 다시 읽는다. 표로도 안 되면 **구분줄만 버리고** 층으로
   * 읽는다. 문단으로 떨어뜨리면 `상태 코드 | 분류` 같은 파이프가 줄글에 그대로
   * 새어 나와 `---` 층보다 더 나쁘다. 구분줄은 계층에서 아무 뜻이 없으니
   * 버리는 것이 맞다.
   */
  let body = lines
  if (lines.some((l) => isDivider(l))) {
    const asTable = parseTable(lines)
    if (asTable) return asTable
    body = lines.filter((l) => !isDivider(l))
  }

  const layers: StackLayer[] = []
  for (const line of body) {
    const m = STACK_LINE.exec(line.trim())
    if (!m || m[1].trim().length === 0) return null
    layers.push({ name: m[1].trim(), note: (m[2] ?? '').trim() })
  }
  return layers.length > 0 ? { type: 'stack', layers } : null
}

/** `|` 로 나뉜 칸. 앞뒤 파이프는 있어도 없어도 된다 */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())
}

/** `|---|---|` 구분줄인가 */
/**
 * 마크다운 표의 구분줄인가.
 *
 * 파서와 검사기가 같은 정의를 써야 한다. 검사기가 따로 정규식을 들면
 * `--- | ---`처럼 칸이 여럿인 줄에서 판정이 갈린다(실제로 갈렸다).
 */
export function isDivider(line: string): boolean {
  const parts = cells(line)
  return parts.length > 0 && parts.every((c) => /^:?-{2,}:?$/.test(c))
}

/**
 * 마크다운 표.
 *
 * 모델이 가장 안정적으로 쓰는 형식이라 따로 문법을 만들지 않고 그대로 받는다.
 * 머리글과 구분줄이 둘 다 있어야 표로 본다. 파이프 하나 들어간 문장을 표로
 * 오인하면 본문이 깨진다.
 */
function parseTable(lines: string[]): Block | null {
  if (lines.length < 3) return null
  if (!lines[0].includes('|') || !isDivider(lines[1])) return null

  const head = cells(lines[0])
  const rows: string[][] = []

  for (const line of lines.slice(2)) {
    if (!line.includes('|')) return null
    const row = cells(line)
    // 칸 수가 어긋나면 표가 아니다. 억지로 맞추면 엉뚱한 칸에 값이 들어간다
    if (row.length !== head.length) return null
    rows.push(row)
  }

  return rows.length > 0 ? { type: 'table', head, rows } : null
}

/**
 * 본문을 블록으로 나눈다.
 *
 * 빈 줄로 먼저 자르고, 조각마다 어떤 블록인지 본다. `:::` 울타리는 안에 빈 줄이
 * 들어갈 수 있어서 먼저 훑어 통째로 떼어낸다.
 */
/**
 * 문장 끝에 붙은 울타리를 떼어낸다.
 *
 * 모델이 "…나뉜다. :::stack" 처럼 한 줄에 이어 쓰는 경우가 실제로 나왔다.
 * 그대로 두면 여는 줄로 못 알아보고 도식이 통째로 문단이 된다. 앞의 문장과
 * 울타리를 두 줄로 갈라 주면 되살아난다.
 */
function splitTrailingFence(lines: string[]): string[] {
  const out: string[] = []

  for (const line of lines) {
    const m = /^(.*\S)\s+(:::\s*(?:flow|state|tree|memory|timeline|stack)\b.*)$/.exec(line)
    if (m) {
      out.push(m[1])
      out.push(m[2])
    } else {
      out.push(line)
    }
  }

  return out
}

export function parseBlocks(body: string): Block[] {
  const lines = splitTrailingFence(body.split('\n'))
  const blocks: Block[] = []

  let buffer: string[] = []

  const flushParagraphs = () => {
    const text = buffer.join('\n')
    buffer = []
    for (const chunk of text.split(/\n{2,}/)) {
      const trimmed = chunk.trim()
      if (trimmed.length === 0) continue

      const table = parseTable(trimmed.split('\n'))
      if (table) {
        blocks.push(table)
        continue
      }

      const cleaned = trimmed
        .split('\n')
        .filter((l) => !FENCE_ONLY_LINE.test(l))
        .join('\n')
        .replace(INLINE_FENCE, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()

      if (cleaned.length > 0) blocks.push({ type: 'paragraph', text: cleaned })
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const open = FENCE_OPEN.exec(lines[i].trim())
    if (!open) {
      buffer.push(lines[i])
      continue
    }

    // 닫는 울타리를 찾는다. 없으면 여는 줄도 그냥 글자다
    let close = -1
    for (let j = i + 1; j < lines.length; j += 1) {
      if (FENCE_CLOSE.test(lines[j].trim())) {
        close = j
        break
      }
    }
    if (close === -1) {
      buffer.push(lines[i])
      continue
    }

    const inner = lines.slice(i + 1, close).filter((l) => l.trim().length > 0)
    const parsed =
      open[1] === 'flow'
        ? parseFlow(inner)
        : open[1] === 'state'
          ? parseState(inner)
          : open[1] === 'tree'
            ? parseTree(inner)
            : open[1] === 'memory'
              ? parseMemory(inner)
              : open[1] === 'timeline'
                ? parseTimeline(inner)
                : parseStack(inner)

    flushParagraphs()

    if (parsed) {
      blocks.push(parsed)
    } else {
      // 문법이 틀렸으면 내용만 문단으로 살린다. 울타리 기호는 보여줄 이유가 없다
      const text = inner.join(' ').trim()
      if (text.length > 0) blocks.push({ type: 'paragraph', text })
    }

    i = close
  }

  flushParagraphs()
  return blocks
}
