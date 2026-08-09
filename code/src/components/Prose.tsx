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
  return (
    <div className="prose-body text-[16px] text-ink sm:text-[17px]">
      {parseBlocks(body).map((block, i) => {
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
              <p key={i}>
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
