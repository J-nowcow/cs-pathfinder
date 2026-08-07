import { parseBlocks } from '@/lib/markdown/blocks'
import { FlowDiagram, StateDiagram, TreeDiagram } from '@/components/Diagram'
import { FlowSvg, StateSvg, TreeSvg } from '@/components/DiagramSvg'

/** 시안 비교용. 결정 나면 지운다 */
const CASES = [
  {
    title: '순서 — TCP 4-way handshake',
    body: ':::flow\n능동 종료 -> 수동 종료: FIN. 보낼 것은 다 보냈다\n수동 종료 -> 능동 종료: ACK. 알겠다\n수동 종료 -> 능동 종료: FIN. 나도 다 보냈다\n능동 종료 -> 수동 종료: 마지막 ACK\n:::',
  },
  {
    title: '상태 — 서킷 브레이커',
    body: ':::state\n닫힘 -> 열림: 실패가 임계치를 넘는다\n열림 -> 반열림: 대기 시간이 지난다\n반열림 -> 닫힘: 시험 요청이 성공한다\n반열림 -> 열림: 시험 요청이 실패한다\n:::',
  },
  {
    title: '트리 — 자바 예외',
    body: ':::tree\nThrowable\n  Error | 복구할 수 없다\n  Exception\n    RuntimeException | 검사하지 않는다\n    IOException | 검사한다\n:::',
  },
]

export default function Page() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-8">
      <h1 className="mb-2 text-[22px] font-bold">도식 시안 비교</h1>
      <p className="mb-8 text-[14px] text-muted">
        왼쪽이 지금 것(박스·목록), 오른쪽이 SVG 시안(선·화살표).
      </p>

      {CASES.map((c) => {
        const b = parseBlocks(c.body)[0]
        return (
          <section key={c.title} className="mb-12">
            <h2 className="mb-3 text-[15px] font-medium">{c.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[12px] text-faint">지금</p>
                {b.type === 'flow' && <FlowDiagram steps={b.steps} />}
                {b.type === 'state' && <StateDiagram steps={b.steps} />}
                {b.type === 'tree' && <TreeDiagram nodes={b.nodes} />}
              </div>
              <div>
                <p className="text-[12px] text-faint">SVG 시안</p>
                {b.type === 'flow' && <FlowSvg steps={b.steps} />}
                {b.type === 'state' && <StateSvg steps={b.steps} />}
                {b.type === 'tree' && <TreeSvg nodes={b.nodes} />}
              </div>
            </div>
          </section>
        )
      })}
    </main>
  )
}
