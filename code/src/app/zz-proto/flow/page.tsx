import { parseBlocks } from '@/lib/markdown/blocks'
import { FlowDiagram } from '@/components/Diagram'
import { FlowProto } from '@/components/diagram/proto/FlowProto'

/** 흐름 도식 시안. 결정 나면 지운다 */

const CASES = [
  {
    title: '선형 — 주소창에 URL을 넣고 화면이 그려지기까지',
    note: '갈림도 되돌아감도 없는 가장 흔한 모양. 이름이 한 번씩만 나오고 사이를 화살표가 잇는다.',
    body: [
      ':::flow',
      '주소창 입력 -> DNS 조회: 도메인 이름을 IP 주소로 바꾼다',
      'DNS 조회 -> TCP 연결: 3-way handshake로 통로를 연다',
      'TCP 연결 -> TLS 협상: 인증서를 확인하고 열쇠를 나눈다',
      'TLS 협상 -> HTTP 요청: `GET /` 을 보낸다',
      'HTTP 요청 -> HTML 응답: 서버가 문서를 돌려준다',
      'HTML 응답 -> 렌더링: 파싱해서 화면에 그린다',
      ':::',
    ].join('\n'),
  },
  {
    title: '분기 — CDN 캐시 히트와 미스',
    note: '한 마디에서 두 갈래가 나가고 다시 한곳으로 모인다. 갈림은 트렁크와 조건 칩으로, 다시 모이는 것은 «합류» 칩으로 그린다.',
    body: [
      ':::flow',
      '요청 도착 -> 캐시 확인: 엣지 노드가 받는다',
      '캐시 확인 -> 캐시 히트: 저장된 사본이 살아 있으면',
      '캐시 확인 -> 원본 조회: 없거나 유효 기간이 지났으면',
      '캐시 히트 -> 응답 반환: 엣지에서 바로 준다',
      '원본 조회 -> 캐시 저장: 원본 서버에서 받아온다',
      '캐시 저장 -> 응답 반환: 다음 요청을 위해 남긴다',
      ':::',
    ].join('\n'),
  },
  {
    title: '되돌아감 — HTTP 요청 재시도와 지수 백오프',
    note: '갈래 안쪽에서 맨 위 마디로 되돌아간다. 점선 괄호가 되풀이되는 구간을 감싸고, 칩이 몇 번 마디로 가는지 말한다.',
    body: [
      ':::flow',
      '요청 보내기 -> 응답 대기: 서버로 보낸다',
      '응답 대기 -> 성공 처리: **2xx** 응답이 온다',
      '응답 대기 -> 재시도 판단: **5xx** 이거나 시간이 다 된다',
      '재시도 판단 -> 실패 종료: 정해둔 횟수를 다 썼다',
      '재시도 판단 -> 대기 시간 늘리기: 아직 남았다',
      '대기 시간 늘리기 -> 요청 보내기: 두 배로 쉬었다가 다시 보낸다',
      ':::',
    ].join('\n'),
  },
]

export default function Page() {
  return (
    <main className="mx-auto max-w-[880px] px-5 py-8">
      <h1 className="mb-3 text-[22px] font-bold">흐름 도식 시안</h1>

      <div className="mb-8 space-y-2 text-[14px] leading-[1.7] text-muted">
        <p>
          지금 것은 <strong className="font-semibold text-ink">간선을 상자로</strong> 그린다.{' '}
          <code className="rounded bg-accent-soft px-1 font-mono text-[13px]">A -&gt; B: 설명</code>{' '}
          한 줄이 한 행이 되어 이름이 두 번씩 나오고, 화면은 번호 붙은 목록으로 읽힌다.
        </p>
        <p>
          시안은 뒤집었다.{' '}
          <strong className="font-semibold text-ink">마디를 상자로, 설명을 화살표에</strong> 얹는다.
          이름은 한 번만 나오고 사이는 선으로 이어진다 — 그것이 순서도의 생김새다.
        </p>
        <p>
          갈림은 왼쪽 트렁크에서 팔을 뻗어 조건 칩을 달고, 되돌아감은 되풀이 구간을 점선 괄호로
          감싼다. 괄호 높이는 브라우저가 정한다(<code className="font-mono text-[13px]">inset-y-0</code>
          ). 좌표를 손으로 계산하지 않으므로 반려된 SVG 시안처럼 이름표가 포개질 자리가 없다.
        </p>
        <p>
          선과 화살촉은 전부 <code className="font-mono text-[13px]">aria-hidden</code>이다. 순서는{' '}
          <code className="font-mono text-[13px]">&lt;ol&gt;</code>이, 갈림은 조건 글자가, 되돌아감은
          &quot;1번 «요청 보내기»&quot;라는 문장이 진다. 그림을 다 지워도 글로 읽힌다.
        </p>
      </div>

      {CASES.map((c) => {
        const block = parseBlocks(c.body)[0]
        if (!block || block.type !== 'flow') {
          return (
            <p key={c.title} className="mb-12 text-[14px] text-warn">
              {c.title} — 파서가 flow로 안 읽었다
            </p>
          )
        }

        return (
          <section key={c.title} className="mb-14">
            <h2 className="text-[16px] font-semibold text-ink">{c.title}</h2>
            <p className="mt-1 mb-4 text-[13px] leading-[1.6] text-muted">{c.note}</p>

            <div className="flex flex-wrap gap-6">
              <div>
                <p className="mb-1 text-[12px] text-faint">지금 (폰 390px)</p>
                <div className="w-[390px] rounded-xl border border-line bg-surface px-5">
                  <FlowDiagram steps={block.steps} />
                </div>
              </div>
              <div>
                <p className="mb-1 text-[12px] text-faint">시안 (폰 390px)</p>
                <div className="w-[390px] rounded-xl border border-line bg-surface px-5">
                  <FlowProto steps={block.steps} />
                </div>
              </div>
            </div>
          </section>
        )
      })}

      <section className="mb-10">
        <h2 className="text-[16px] font-semibold text-ink">문법은 그대로다</h2>
        <p className="mt-1 text-[13px] leading-[1.6] text-muted">
          위 세 개는 전부 지금 쓰는 <code className="font-mono">:::flow</code> 울타리를{' '}
          <code className="font-mono">parseBlocks</code>에 그대로 넣어 그린 것이다. 파서도 생성
          프롬프트도 손대지 않았다.
        </p>
      </section>
    </main>
  )
}
