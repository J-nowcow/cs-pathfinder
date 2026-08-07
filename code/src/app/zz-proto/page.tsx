import Link from 'next/link'

/**
 * 도식 시안 목차.
 *
 * 해설이 표와 목록뿐이라는 지적에서 시작했다. 손으로 좌표를 계산한 SVG는
 * 선과 화살표가 깨져 반려됐고, 그래서 **어떤 그림을 어떤 모양으로 그릴지부터**
 * 다시 정하는 중이다. 다섯 갈래를 따로 만들어 눈으로 고른다.
 *
 * 고른 뒤에는 이 폴더째로 지운다. 임시다.
 */
const PROTOS = [
  {
    slug: 'ratio',
    title: '비교 · 비율',
    what: '시간복잡도, 캐시 계층 접근 시간처럼 크기를 견주는 것',
    hard: '1ns와 100µs처럼 자릿수가 벌어지면 선형 막대로는 작은 쪽이 안 보인다',
  },
  {
    slug: 'flow',
    title: '흐름',
    what: 'URL 입력부터 렌더링까지, 컴파일 파이프라인처럼 단계가 이어지는 것',
    hard: '캐시 히트·미스처럼 갈라지고 재시도처럼 되돌아오는 길',
  },
  {
    slug: 'state',
    title: '상태 전이',
    what: '프로세스 상태, TCP 상태 기계처럼 순서가 아니라 관계인 것',
    hard: '임의 그래프는 배치 계산이 필요해 배제됐다. 배치 없이 관계를 보이기',
  },
  {
    slug: 'layers',
    title: '계층 · 메모리',
    what: '메모리 구조, 호출 스택, OSI 계층처럼 층으로 쌓인 것',
    hard: '"위가 무엇인가"가 종류마다 다르다. 높은 주소, 최근 호출, 응용 계층',
  },
  {
    slug: 'seq',
    title: '주고받음',
    what: 'TCP 3-way, OAuth처럼 둘 이상이 메시지를 주고받는 것',
    hard: '390px에서 주체가 셋을 넘으면 좌우로 놓을 자리가 없다',
  },
]

export default function ProtoIndex() {
  return (
    <main className="mx-auto max-w-[640px] px-5 py-10">
      <h1 className="text-[20px] font-bold">도식 시안</h1>
      <p className="mt-2 text-[14px] leading-[1.75] text-muted">
        다섯 갈래를 따로 만들었다. 각각 실제 CS 내용으로 예시 세 개를 그렸다. 폰 390px에서 보고
        고른다.
      </p>

      <ul className="mt-8 space-y-3">
        {PROTOS.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/zz-proto/${p.slug}`}
              className="block rounded-xl border border-line bg-raised px-4 py-4 transition-colors hover:border-accent"
            >
              <span className="block text-[15px] font-bold">{p.title}</span>
              <span className="mt-1 block text-[13px] leading-[1.6] text-muted">{p.what}</span>
              <span className="mt-2 block text-[12px] leading-[1.6] text-faint">
                어려운 지점 — {p.hard}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
