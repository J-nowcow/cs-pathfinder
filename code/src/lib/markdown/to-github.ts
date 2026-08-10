import { parseBlocks, type Block } from '@/lib/markdown/blocks'

/**
 * 해설을 GitHub이 그릴 수 있는 마크다운으로 옮긴다.
 *
 * 대문은 "질문 전문은 `cs/questions.md`에 있다"고 말하는데 **그 파일에는 링크
 * 249줄만 있다.** 본문이 없다. 레포를 둘러보는 사람은 읽을 것이 하나도 없이
 * 링크를 하나씩 눌러야 한다. 별을 모으려는 자료 레포에서 그건 치명적이다.
 *
 * 본문을 그대로 넣을 수는 없다. `:::flow` 같은 울타리는 우리 파서만 아는
 * 문법이라 GitHub에서는 **글자 그대로 보인다.** 도식 자리가 통째로 고장 난
 * 텍스트가 된다.
 *
 * **뜻을 잃지 않는 것이 이 변환의 전부다.** 도식은 모양이 아니라 뜻을 나른다 —
 * 순서·소속·방향·동시성. 그 뜻이 글로도 남아야 한다. 그림을 못 그리는 자리라면
 * 그 뜻을 문장으로 적는다.
 *
 * - 순서 → 번호 매긴 목록. 번호가 곧 순서다
 * - 상태 → 출발 상태로 묶은 중첩 목록. 갈래가 "그다음"으로 안 읽히게
 * - 트리 → 들여쓴 중첩 목록. 들여쓰기가 곧 소속이다
 * - 메모리 → 표 + **위가 높은 주소라는 한 줄.** 표만 두면 방향이 사라진다
 * - 타임라인 → 표. 열이 주체, 행이 시각. **빈 칸은 비워 둔다** — 그것이 기다림이다
 * - 계층 → 표 + **위가 위층이라는 한 줄**
 * - 표 → 그대로. GitHub이 이미 그린다
 * - 콜아웃 → GitHub 알림 상자. 우리 화면의 상자와 뜻이 같다
 */

/** 표 칸 안에서 `|`는 칸을 쪼갠다. 살려서 보여주려면 막아야 한다 */
function cell(s: string): string {
  return s.replace(/\|/g, '\\|').trim()
}

function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.map(cell).join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
  ].join('\n')
}

function fromBlock(b: Block): string {
  switch (b.type) {
    case 'paragraph':
      return b.text

    /* 번호가 순서를 대신한다. 라벨이 없는 걸음도 있다(화살표만 쓴 사슬) */
    case 'flow':
      return b.steps
        .map((s, i) => {
          const arrow = `**${s.from} → ${s.to}**`
          return s.label.length > 0 ? `${i + 1}. ${arrow} — ${s.label}` : `${i + 1}. ${arrow}`
        })
        .join('\n')

    /*
     * 출발 상태로 묶는다. 번호를 매기면 **갈림이 순서로 읽힌다** — `반열림 →
     * 닫힘`과 `반열림 → 열림`은 차례가 아니라 둘 중 하나다.
     */
    case 'state': {
      const groups: Array<{ from: string; outs: typeof b.steps }> = []
      for (const s of b.steps) {
        const hit = groups.find((g) => g.from === s.from)
        if (hit) hit.outs.push(s)
        else groups.push({ from: s.from, outs: [s] })
      }
      return groups
        .map((g) => {
          const outs = g.outs
            .map((s) => `  - → **${s.to}**${s.label.length > 0 ? ` — ${s.label}` : ''}`)
            .join('\n')
          return `- **${g.from}**\n${outs}`
        })
        .join('\n')
    }

    /* 들여쓰기가 곧 소속이다. GitHub은 두 칸이면 한 단계로 읽는다 */
    case 'tree':
      return b.nodes
        .map((n) => {
          const pad = '  '.repeat(n.depth)
          return `${pad}- **${n.name}**${n.note.length > 0 ? ` — ${n.note}` : ''}`
        })
        .join('\n')

    /*
     * 표만 두면 **위아래가 주소라는 것**과 마주 자란다는 것이 통째로 사라진다.
     * 그 둘이 이 도식의 존재 이유라 한 줄로 적는다.
     */
    case 'memory': {
      const rows = b.areas.map((a) => [
        a.name,
        a.note,
        a.grow === 'up' ? '위로 자란다' : a.grow === 'down' ? '아래로 자란다' : '',
      ])
      return `위가 높은 주소, 아래가 낮은 주소다.\n\n${table(['영역', '설명', '방향'], rows)}`
    }

    /*
     * 열이 주체, 행이 시각이다. **빈 칸을 채우지 않는다** — 비어 있는 것이
     * 기다림이라는 뜻이고, `-`로 메우면 무언가 한 것처럼 읽힌다.
     */
    case 'timeline': {
      const slots = b.rows[0]?.slots.length ?? 0
      const rows = Array.from({ length: slots }, (_, t) => [
        String(t + 1),
        ...b.rows.map((r) => r.slots[t] ?? ''),
      ])
      return table(['', ...b.rows.map((r) => r.actor)], rows)
    }

    /* 위가 위층이다. 표는 순서를 안 말해 주므로 적어 준다 */
    case 'stack':
      return `위가 위층이다.\n\n${table(
        ['층', '설명'],
        b.layers.map((l) => [l.name, l.note]),
      )}`

    case 'table':
      return table(b.head, b.rows)

    /*
     * GitHub은 인용 안의 `[!NOTE]`·`[!WARNING]`을 상자로 그린다. 우리 화면의
     * 콜아웃과 뜻이 같다 — 한 번 더 세운 말과 밟기 쉬운 자리.
     *
     * **빈 줄에도 `>`를 붙여야 한 상자로 이어진다.** 안 붙이면 둘째 문단부터
     * 인용 밖으로 떨어져 나와 상자 아래에 따로 놓인다.
     */
    case 'note':
    case 'warn':
      return [
        `> ${b.type === 'note' ? '[!NOTE]' : '[!WARNING]'}`,
        ...b.paragraphs
          .join('\n\n')
          .split('\n')
          .map((l) => (l.length > 0 ? `> ${l}` : '>')),
      ].join('\n')
  }
}

export function toGithubMarkdown(body: string): string {
  return parseBlocks(body).map(fromBlock).join('\n\n')
}
