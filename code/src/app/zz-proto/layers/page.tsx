import {
  MemoryMap,
  CallStack,
  Encapsulation,
  type Slice,
  type Frame,
  type Wrap,
} from '@/components/diagram/proto/LayersProto'

/** 층·메모리 도식 시안. 결정 나면 지운다 */

/**
 * 프로세스 메모리 구조.
 *
 * 목록 순서가 곧 화면 순서다. 위가 높은 주소이므로 스택을 먼저 쓴다.
 */
const MEMORY: Slice[] = [
  { name: '스택', note: '함수를 부를 때마다 프레임이 얹힌다', grow: 'down' },
  { name: '빈 공간', empty: true },
  { name: '힙', note: 'malloc·new로 그때그때 빌려 쓰는 자리', grow: 'up' },
  { name: '데이터', note: '전역 변수와 static 변수. 프로그램이 끝날 때까지 산다' },
  { name: '코드', note: '기계어 명령. 실행 중에 바뀌지 않는다' },
]

/** 호출 스택. 맨 앞이 맨 위 = 지금 실행 중 */
const CALLS: Frame[] = [
  {
    name: 'divide(6, 0)',
    note: '0으로 나누려다 멈췄다',
    slots: ['a=6', 'b=0', '돌아갈 곳: average'],
  },
  { name: 'average(nums)', slots: ['합=6', '개수=0', '돌아갈 곳: main'] },
  { name: 'main()', note: '프로그램이 시작한 자리', slots: ['nums=[]'] },
]

/**
 * TCP/IP 캡슐화.
 *
 * 맨 앞이 알맹이를 만드는 계층이고, 아래로 내려가며 앞에 헤더가 붙는다.
 */
const PACKET: Wrap[] = [
  { name: '응용', part: 'HTTP 요청', note: '보내려는 알맹이' },
  { name: '전송', part: 'TCP 헤더', note: '포트 번호와 순서 번호' },
  { name: '인터넷', part: 'IP 헤더', note: '출발지와 목적지 주소' },
  { name: '링크', part: 'Eth 헤더', note: '옆 장비까지의 MAC 주소', tail: 'FCS' },
]

export default function Page() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-8">
      <h1 className="mb-3 text-[22px] font-bold">층·메모리 도식 시안</h1>

      <div className="mb-9 space-y-1.5 text-[14px] leading-[1.75] text-muted">
        <p>
          층 도식은 축이 없으면 표다. 지금 것은 테두리 친 목록이라 &ldquo;위&rdquo;에 아무
          뜻이 없다. 그래서 <strong className="text-ink">축을 필수로 만들었다</strong> —
          그림 위아래에 위쪽이 무엇인지 문장으로 적는다.
        </p>
        <p>
          축 문장은 숨긴 글이 아니라 <strong className="text-ink">보이는 글</strong>이다.
          방향은 이 도식에서 가장 틀리기 쉬운 것이라 눈으로 읽는 사람도 같이 봐야 한다.
        </p>
        <p>
          종류마다 <strong className="text-ink">붙는 방식을 다르게</strong> 했다. 메모리는
          칸이 맞붙어 하나의 덩어리고, 호출 프레임은 떨어진 카드다. 형태가 다르면 앞
          도식에서 읽은 &ldquo;위&rdquo;를 그대로 들고 오지 않는다.
        </p>
        <p>
          캡슐화는 층이 아니다. 겹겹이 감싸는 것이라 가로 막대로 따로 그렸다.
        </p>
        <p>
          SVG를 안 쓴다. 전부 flex와 grid라 글자 길이가 달라져도 선과 이름표가 겹치지
          않는다.
        </p>
      </div>

      <section className="mb-12">
        <h2 className="text-[15px] font-medium">1. 프로세스 메모리 구조</h2>
        <p className="mt-1 text-[13px] leading-[1.7] text-muted">
          위가 높은 주소다. 스택과 힙이 가운데 빈 곳을 향해 마주 자란다 — 빗금 친 넓은
          칸이 이 도식의 요점이다.
        </p>
        <MemoryMap
          up="위쪽이 높은 주소다"
          down="아래쪽이 낮은 주소다"
          slices={MEMORY}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-[15px] font-medium">2. 함수 호출 스택</h2>
        <p className="mt-1 text-[13px] leading-[1.7] text-muted">
          같은 &ldquo;스택&rdquo;인데 위의 뜻이 다르다. 여기서 위는 가장 최근 호출이라
          주소로 보면 1번 그림과 <strong className="text-ink">반대 방향</strong>이다. 칸을
          띄우고 안에 든 것을 보여 줘 형태부터 갈라 놓았다.
        </p>
        <CallStack
          up="위쪽이 가장 최근에 부른 함수다"
          down="아래쪽이 맨 처음 부른 함수다"
          frames={CALLS}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-[15px] font-medium">3. TCP/IP 캡슐화</h2>
        <p className="mt-1 text-[13px] leading-[1.7] text-muted">
          층으로 그리면 헤더가 겹겹이 붙는다는 것이 사라진다. 한 줄이 그 계층에서 본
          패킷 생김새다.
        </p>
        <Encapsulation
          up="위쪽이 응용에 가깝다"
          down="아래쪽이 전선에 가깝다"
          layers={PACKET}
        />
      </section>

      <p className="text-[12px] text-faint">
        폰 390px 기준으로 짰다. 밝은 모드와 어두운 모드 둘 다에서 확인할 것.
      </p>
    </main>
  )
}
