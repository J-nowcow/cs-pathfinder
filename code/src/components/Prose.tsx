import { Fragment } from 'react'
import { parseInline } from '@/lib/markdown/inline'
import { parseBlocks } from '@/lib/markdown/blocks'
import {
  FlowDiagram,
  StateDiagram,
  TreeDiagram,
  MemoryDiagram,
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
          case 'stack':
            return <StackDiagram key={i} layers={block.layers} />
          case 'table':
            return <TableDiagram key={i} head={block.head} rows={block.rows} />
          case 'paragraph':
            return (
              <p key={i}>
                {parseInline(block.text).map((t, j) => (
                  <Fragment key={j}>
                    {t.type === 'bold' ? (
                      <strong>{t.value}</strong>
                    ) : t.type === 'code' ? (
                      <code>{t.value}</code>
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
