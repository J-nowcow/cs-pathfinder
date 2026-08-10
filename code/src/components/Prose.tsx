import { Fragment } from 'react'
import { parseInline } from '@/lib/markdown/inline'
import { parseBlocks } from '@/lib/markdown/blocks'
import { linkifyTokens } from '@/lib/glossary/linkify'
import {
  FlowDiagram,
  StateDiagram,
  TreeDiagram,
  MemoryDiagram,
  TimelineDiagram,
  StackDiagram,
  TableDiagram,
} from '@/components/Diagram'

/**
 * 해설 본문 렌더러.
 *
 * dangerouslySetInnerHTML을 쓰지 않는다. 자유 입력이 전역 자산이 되므로
 * 오염이 증폭되고, HTML 경로를 아예 두지 않는 편이 정화보다 확실하다.
 *
 * 문단만 그리던 것을 블록 단위로 넓혔다. 순서·계층·비교를 줄글로만 읽히면
 * 독자가 머리로 다시 그려야 한다 — 그 몫을 도식이 진다. 도식도 전부 React
 * 요소로 만들기 때문에 위 원칙은 그대로다.
 */
export function Prose({ body }: { body: string }) {
  /*
   * 용어 링크의 "첫 등장"은 **본문 단위**다. 문단마다 Set을 새로 만들면
   * 문단 수만큼 같은 링크가 생긴다. 렌더마다 새로 만들므로 요청 간에
   * 새지 않는다.
   */
  const seenTerms = new Set<string>()

  const blocks = parseBlocks(body)

  /**
   * 첫 문단이 답이다.
   *
   * 생성 규칙이 "답 먼저 → 도식 → 근거"라 첫 문단에는 늘 결론이 들어 있다.
   * 그런데 나머지 문단과 같은 크기로 흘리면 그 사실이 글자에 묻힌다. 읽는
   * 사람은 답을 찾으려고 본문 전체를 훑게 된다.
   *
   * **본문을 한 글자도 안 고친다.** 저장된 글에 `**`를 넣어 첫 문장을 굵게
   * 만드는 방법도 있었지만 그러면 322편을 전부 다시 써야 하고, 규칙이 바뀔
   * 때마다 또 써야 한다. 렌더러가 첫 문단을 다르게 그리는 쪽이 되돌리기도
   * 쉽다.
   *
   * **번호가 아니라 종류로 찾는다.** `blocks[0]`이 아니다 — 모델이 도식이나
   * 표를 먼저 놓는 경우가 있고, 그때 `blocks[0]`은 문단이 아니다. 그러면
   * 리드가 통째로 사라지거나 도식에 문단 스타일이 붙는다. 처음 나오는
   * **문단**을 찾는다. 문단이 하나도 없으면 `-1`이라 아무것도 안 붙는다.
   */
  const leadIndex = blocks.findIndex((b) => b.type === 'paragraph')

  return (
    <div className="prose-body text-[16px] text-ink sm:text-[17px]">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'flow':
            return <FlowDiagram key={i} steps={block.steps} />
          case 'state':
            return <StateDiagram key={i} steps={block.steps} />
          case 'tree':
            return <TreeDiagram key={i} nodes={block.nodes} />
          case 'memory':
            return <MemoryDiagram key={i} areas={block.areas} />
          case 'timeline':
            return <TimelineDiagram key={i} rows={block.rows} />
          case 'stack':
            return <StackDiagram key={i} layers={block.layers} />
          case 'table':
            return <TableDiagram key={i} head={block.head} rows={block.rows} />
          case 'paragraph':
            return (
              <p key={i} className={i === leadIndex ? 'prose-lead' : undefined}>
                {linkifyTokens(parseInline(block.text), seenTerms).map((t, j) => (
                  <Fragment key={j}>
                    {t.type === 'bold' ? (
                      <strong>{t.value}</strong>
                    ) : t.type === 'code' ? (
                      <code>{t.value}</code>
                    ) : t.type === 'term' ? (
                      /*
                       * 낭독기는 링크 텍스트(용어 자체)를 읽는다. title은
                       * 마우스 올림에서 뜻을 보여 주는 덤이고, 뜻 전체는
                       * 링크가 닿는 사전 페이지에 있다.
                       */
                      <a
                        href={`/glossary#${encodeURIComponent(t.term)}`}
                        title={t.short}
                        className="rounded-sm underline decoration-dotted underline-offset-2 hover:bg-surface"
                      >
                        {t.value}
                      </a>
                    ) : (
                      t.value
                    )}
                  </Fragment>
                ))}
              </p>
            )
        }
      })}
    </div>
  )
}
