import { RatioBars, RatioBand, type RatioItem } from '@/components/diagram/proto/RatioProto'

/** 시안 검토용. 결정 나면 지운다 */

/*
 * 값은 전부 널리 인용되는 대략값이다. 시안의 요점은 정확한 수치가 아니라
 * **자릿수가 얼마나 벌어지는가**이므로 어림수로 둔다.
 */
const CACHE: RatioItem[] = [
  { name: 'L1 캐시', value: 1, display: '1 ns', note: '코어 안에 붙어 있다' },
  { name: 'L2 캐시', value: 4, display: '4 ns' },
  { name: 'L3 캐시', value: 12, display: '12 ns', note: '코어끼리 나눠 쓴다' },
  { name: '메인 메모리', value: 100, display: '100 ns' },
  { name: 'NVMe SSD', value: 100_000, display: '100 µs' },
  { name: '하드디스크 탐색', value: 10_000_000, display: '10 ms', note: '판이 물리적으로 돈다' },
]

const HEADERS: RatioItem[] = [
  { name: '이더넷 헤더', value: 14, note: 'MAC 주소 둘 12 + 타입 2' },
  { name: 'IPv4 헤더', value: 20, note: '옵션이 없을 때' },
  { name: 'IPv6 헤더', value: 40, note: '길이가 고정이다' },
  { name: 'TCP 헤더', value: 20, note: '옵션이 없을 때' },
  { name: 'UDP 헤더', value: 8, note: '포트 둘·길이·검사합뿐' },
]

const FRAME: RatioItem[] = [
  { name: '이더넷 헤더', value: 14 },
  { name: 'IPv4 헤더', value: 20 },
  { name: 'TCP 헤더', value: 20 },
  { name: '데이터', value: 6, note: '실제로 나르는 것' },
  { name: 'FCS', value: 4, note: '오류 검사용 꼬리' },
]

export default function Page() {
  return (
    <main className="mx-auto max-w-[560px] px-5 py-8">
      <h1 className="text-[22px] font-bold text-ink">비교·비율 시안</h1>

      <div className="mt-3 space-y-2 text-[14px] leading-[1.75] text-muted">
        <p>
          <strong className="font-medium text-ink">막대 길이를 재지 않고 칸을 센다.</strong> 캐시
          1 ns와 디스크 10 ms를 길이에 그대로 비례시키면 캐시는 화면에서 사라지고, 로그로 눕히면
          두 배 긴 막대가 100배인지 1만 배인지 알 수 없다. 눈금을 자릿수 칸으로 끊고 한 칸이
          10배라고 그림 위에 적었다.
        </p>
        <p>
          자릿수가 두 개 미만이면 이 장치를 끄고 길이에 그대로 비례시킨다. 안 벌어진 값에까지
          로그를 씌우면 없는 왜곡을 만든다.
        </p>
        <p>
          그림은 전부 div와 CSS 폭(%)이다. 좌표를 손으로 계산하지 않으므로 이름이 길어져도 선이
          어긋날 자리가 없다. 이름·값·배수는 모두 눈에 보이는 글자이고 막대는{' '}
          <code className="font-mono text-[13px]">aria-hidden</code>이다.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-[15px] font-medium text-ink">1. 자릿수가 일곱 벌어지는 값</h2>
        <p className="mt-1 text-[13px] leading-[1.6] text-faint">
          캐시부터 디스크까지 접근 시간. 가장 작은 값도 한 칸을 받으므로 사라지지 않고, 칸을 세면
          자릿수가 그대로 읽힌다.
        </p>
        <RatioBars items={CACHE} />

        <details className="mt-2 rounded-lg border border-line bg-raised px-4 py-3">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-accent">
            지금은 이렇게 나간다 (표)
          </summary>
          <p className="mt-2 text-[13px] leading-[1.6] text-faint">
            값은 다 적혀 있지만 <strong className="font-medium text-muted">1 ns와 10 ms 사이가
            얼마나 먼지</strong>는 0을 세어야 안다. 그 거리가 이 이야기의 요점이다.
          </p>
          <table className="mt-2.5 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-1.5 text-[12px] font-medium text-faint">
                  계층
                </th>
                <th scope="col" className="py-1.5 text-[12px] font-medium text-faint">
                  접근 시간
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {CACHE.map((c) => (
                <tr key={c.name}>
                  <td className="py-1.5 text-[13px] text-ink">{c.name}</td>
                  <td className="py-1.5 font-mono text-[13px] text-muted">{c.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="mt-10">
        <h2 className="text-[15px] font-medium text-ink">2. 자릿수가 같은 값</h2>
        <p className="mt-1 text-[13px] leading-[1.6] text-faint">
          프로토콜 헤더 크기(바이트). 가장 큰 값과 작은 값이 다섯 배 차이라 칸 눈금을 끄고 길이에
          그대로 비례시켰다. IPv6가 IPv4의 두 배라는 것이 길이로 바로 보인다.
        </p>
        <RatioBars items={HEADERS} unit="B" />
      </section>

      <section className="mt-10">
        <h2 className="text-[15px] font-medium text-ink">3. 하나를 나눠 가진 몫</h2>
        <p className="mt-1 text-[13px] leading-[1.6] text-faint">
          최소 이더넷 프레임 64바이트의 구성. 따로 있는 값을 견주는 것이 아니라 전체를 나눈
          것이라 띠로 붙인다. 헤더가 프레임의 절반을 넘는다는 사실은 붙여 놓아야 보인다.
        </p>
        <RatioBand items={FRAME} unit="B" />
      </section>

      <p className="mt-12 border-t border-line pt-4 text-[12px] leading-[1.6] text-faint">
        폰 390px 기준으로 짰다. 가로 스크롤이 생기는 곳이 없어야 하고, 밝은 모드와 어두운 모드
        양쪽에서 막대·눈금·번호가 다 읽혀야 한다.
      </p>
    </main>
  )
}
