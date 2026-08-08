import { SeqProto, type SeqRow } from '@/components/diagram/proto/SeqProto'

/** 시안 검토용. 결정 나면 지운다 */

const TCP: SeqRow[] = [
  { type: 'msg', from: '클라이언트', to: '서버', label: '`SYN`. 내 첫 순서 번호는 x다' },
  { type: 'msg', from: '서버', to: '클라이언트', label: '`SYN+ACK`. 내 번호는 y고, 네 x는 받았다' },
  { type: 'msg', from: '클라이언트', to: '서버', label: '`ACK`. 네 y도 받았다' },
]

const OAUTH: SeqRow[] = [
  { type: 'msg', from: '사용자', to: '앱 서버', label: '로그인을 누른다' },
  { type: 'msg', from: '앱 서버', to: '사용자', label: '인가 서버 주소로 보낸다. 비밀번호는 앱을 거치지 않는다' },
  { type: 'msg', from: '사용자', to: '인가 서버', label: '아이디와 비밀번호를 넣는다' },
  { type: 'msg', from: '인가 서버', to: '사용자', label: '**인가 코드**를 준다. 토큰이 아니다' },
  { type: 'msg', from: '사용자', to: '앱 서버', label: '인가 코드를 넘긴다' },
  { type: 'msg', from: '앱 서버', to: '인가 서버', label: '인가 코드에 **앱 비밀키**를 얹어 토큰으로 바꾼다' },
  { type: 'msg', from: '인가 서버', to: '앱 서버', label: '액세스 토큰. 사용자 화면을 한 번도 거치지 않았다' },
]

const RETRY: SeqRow[] = [
  { type: 'msg', from: '클라이언트', to: '결제 서버', label: '승인 요청. **멱등 키** k를 같이 보낸다' },
  {
    type: 'msg',
    from: '결제 서버',
    to: '클라이언트',
    tone: 'fail',
    label: '응답이 끊긴다. 승인이 됐는지 안 됐는지 알 수 없다',
  },
  { type: 'note', text: '2초 기다린다. 다음엔 4초, 그다음엔 8초 — 지수 백오프' },
  { type: 'msg', from: '클라이언트', to: '클라이언트', label: '키 k를 버리지 않고 그대로 들고 있는다' },
  { type: 'msg', from: '클라이언트', to: '결제 서버', label: '**같은 키** k로 다시 요청한다' },
  {
    type: 'msg',
    from: '결제 서버',
    to: '클라이언트',
    label: '앞서 처리한 결과를 그대로 준다. 두 번 긁히지 않는다',
  },
]

const FOUR: SeqRow[] = [
  { type: 'msg', from: '브라우저', to: '게이트웨이', label: '주문 요청' },
  { type: 'msg', from: '게이트웨이', to: '인증 서버', label: '이 토큰이 살아 있나' },
  { type: 'msg', from: '인증 서버', to: '게이트웨이', label: '유효하다' },
  { type: 'msg', from: '게이트웨이', to: '주문 서버', label: '사용자 id를 붙여 넘긴다' },
  { type: 'msg', from: '주문 서버', to: '브라우저', label: '주문 번호' },
]

const CASES: Array<{
  title: string
  lead: string
  rows: SeqRow[]
  /** 도식만으로는 안 보이는 요점. 없어도 된다 */
  caption?: string
  src: string
}> = [
  {
    title: '2주체 — TCP 3-way handshake',
    lead: '가장 흔한 모양. 왕복이 자리로 보여서 누가 공을 쥐고 있는지 매줄 읽지 않아도 된다.',
    rows: TCP,
    src: `:::seq
클라이언트 -> 서버: \`SYN\`. 내 첫 순서 번호는 x다
서버 -> 클라이언트: \`SYN+ACK\`. 내 번호는 y고, 네 x는 받았다
클라이언트 -> 서버: \`ACK\`. 네 y도 받았다
:::`,
  },
  {
    title: '3주체 — OAuth 인가 코드 흐름',
    lead: '기둥이 셋이라 칸은 130px이지만 설명은 여전히 폭을 다 쓴다. 3·4번 화살표는 가운데 칸을 건너뛴다.',
    rows: OAUTH,
    caption:
      '비밀번호가 오가는 3번 화살표는 앱 서버 기둥을 건너뛴다. 앱이 비밀번호를 못 보는 것이 이 흐름의 요점이고, 그게 자리로 보인다.',
    src: `:::seq
사용자 -> 앱 서버: 로그인을 누른다
앱 서버 -> 사용자: 인가 서버 주소로 보낸다. 비밀번호는 앱을 거치지 않는다
사용자 -> 인가 서버: 아이디와 비밀번호를 넣는다
인가 서버 -> 사용자: **인가 코드**를 준다. 토큰이 아니다
사용자 -> 앱 서버: 인가 코드를 넘긴다
앱 서버 -> 인가 서버: 인가 코드에 **앱 비밀키**를 얹어 토큰으로 바꾼다
인가 서버 -> 앱 서버: 액세스 토큰. 사용자 화면을 한 번도 거치지 않았다
:::`,
  },
  {
    title: '실패와 재시도 — 멱등 키가 있는 결제',
    lead: '닿지 못한 걸음, 사이에 흐르는 시간, 자기 자신에게 하는 일, 다시 보내기가 다 들어 있다.',
    rows: RETRY,
    src: `:::seq
클라이언트 -> 결제 서버: 승인 요청. **멱등 키** k를 같이 보낸다
결제 서버 -x 클라이언트: 응답이 끊긴다. 승인이 됐는지 안 됐는지 알 수 없다
2초 기다린다. 다음엔 4초, 그다음엔 8초 — 지수 백오프
클라이언트 -> 클라이언트: 키 k를 버리지 않고 그대로 들고 있는다
클라이언트 -> 결제 서버: **같은 키** k로 다시 요청한다
결제 서버 -> 클라이언트: 앞서 처리한 결과를 그대로 준다. 두 번 긁히지 않는다
:::`,
  },
]

export default function Page() {
  return (
    <main className="mx-auto max-w-[390px] px-4 py-8">
      <h1 className="text-[20px] font-bold text-ink">주고받음 도식 시안</h1>

      <div className="mt-3 space-y-2 text-[13px] leading-[1.7] text-muted">
        <p>
          좌표를 한 줄도 계산하지 않는다. 생명선은{' '}
          <code className="rounded bg-accent-soft px-1 font-mono text-[0.88em]">
            repeat(N, 1fr)
          </code>
          , 화살표는{' '}
          <code className="rounded bg-accent-soft px-1 font-mono text-[0.88em]">
            0.5fr repeat(N-1, 1fr) 0.5fr
          </code>{' '}
          격자를 쓴다. 양 끝을 반 칸으로 두면 화살표 층의 격자선이 기둥 한가운데에 정확히
          떨어져서, <strong>주체 i의 기둥 = 격자선 i+2</strong> 하나로 끝난다.
        </p>
        <p>
          <strong>칸 안에 글자를 넣지 않는다.</strong> 390px을 넷으로 나누면 97px이라
          한글이 안 들어간다. 칸은 화살표만 나르고 설명은 아래 줄에서 폭을 통째로 쓴다.
          그래서 주체가 늘어도 글자 칸은 줄지 않고 화살표만 짧아진다.
        </p>
        <p>
          방향은 삼각형에만 있으면 안 되므로, 걸음마다 &ldquo;몇 번째, 누가, 누구에게,
          무엇을&rdquo;이 통문장으로 숨어 있다. 보이는 쪽은 통째로{' '}
          <code className="rounded bg-accent-soft px-1 font-mono text-[0.88em]">aria-hidden</code>
          이라 낭독기가 같은 말을 두 번 읽지 않는다.
        </p>
        <p className="text-faint">
          이 페이지는 폭이 390px로 묶여 있다. 보이는 그대로가 폰에서의 크기다.
        </p>
      </div>

      {CASES.map((c) => (
        <section key={c.title} className="mt-9">
          <h2 className="text-[15px] font-semibold text-ink">{c.title}</h2>
          <p className="mt-1 text-[13px] leading-[1.65] break-keep text-muted">{c.lead}</p>

          <SeqProto rows={c.rows} caption={c.caption} />

          <details className="mt-1">
            <summary className="cursor-pointer list-none text-[12px] text-faint">
              이 도식을 만든 글 ▾
            </summary>
            <pre className="mt-1.5 overflow-x-auto rounded-md border border-line bg-surface px-2.5 py-2 font-mono text-[11px] leading-[1.6] text-muted">
              {c.src}
            </pre>
          </details>
        </section>
      ))}

      <section className="mt-9">
        <h2 className="text-[15px] font-semibold text-ink">한계 확인 — 4주체</h2>
        <p className="mt-1 text-[13px] leading-[1.65] break-keep text-muted">
          여기가 끝이다. 칸이 97px이라 기둥 이름이 두 줄로 접히기 시작한다. 다섯이면
          이름부터 무너지므로 파서가 넷에서 막는다.
        </p>
        <SeqProto rows={FOUR} />
      </section>
    </main>
  )
}
