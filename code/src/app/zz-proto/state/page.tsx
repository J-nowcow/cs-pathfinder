import { parseBlocks } from '@/lib/markdown/blocks'
import { StateProto } from '@/components/diagram/proto/StateProto'

/** 시안 검토용. 결정 나면 지운다 */

const CASES = [
  {
    title: '프로세스 상태',
    lead: '한 상태에서 세 갈래로 갈리고, 세 곳에서 한 상태로 모인다.',
    body: [
      ':::state',
      '생성 -> 준비: [메모리 적재 완료] 실행을 기다리는 줄에 선다',
      '준비 -> 실행: [스케줄러가 고른다] CPU를 잡는다',
      '실행 -> 준비: [타임 슬라이스 소진] 자리를 내주고 다시 줄을 선다',
      '실행 -> 대기: [입출력을 요청한다] CPU를 놓고 장치를 기다린다',
      '실행 -> 종료: [exit 호출] 자원을 반납한다',
      '대기 -> 준비: [입출력이 끝난다] 다시 줄에 선다',
      ':::',
    ].join('\n'),
  },
  {
    title: 'TCP 상태 기계 — 연결과 종료',
    lead: '두 갈래로 갈라진 길이 ESTABLISHED에서 만나고, 끝에서 다시 CLOSED로 모인다.',
    body: [
      ':::state',
      'CLOSED -> LISTEN: [listen 호출] 포트를 열고 기다린다',
      'CLOSED -> SYN_SENT: [connect 호출] SYN을 보낸다',
      'LISTEN -> SYN_RCVD: [SYN 받음] SYN+ACK로 답한다',
      'SYN_SENT -> ESTABLISHED: [SYN+ACK 받음] ACK를 보내고 연결이 선다',
      'SYN_RCVD -> ESTABLISHED: [ACK 받음] 연결이 선다',
      'ESTABLISHED -> FIN_WAIT_1: [close 호출] 먼저 끊는 쪽이다. FIN을 보낸다',
      'ESTABLISHED -> CLOSE_WAIT: [FIN 받음] 상대가 먼저 끊었다',
      'FIN_WAIT_1 -> TIME_WAIT: [FIN과 ACK를 받음] 마지막 ACK를 보낸다',
      'CLOSE_WAIT -> LAST_ACK: [close 호출] 남은 것을 보내고 FIN',
      'TIME_WAIT -> CLOSED: [2MSL이 지난다] 늦게 온 조각을 흘려보낸다',
      'LAST_ACK -> CLOSED: [ACK 받음] 자원을 반납한다',
      ':::',
    ].join('\n'),
  },
  {
    title: '자바 스레드 상태 — 전이 조건',
    lead: '어디로 가는지보다 언제 가는지가 답인 경우. 조건이 칩으로 따로 선다.',
    body: [
      ':::state',
      'NEW -> RUNNABLE: [start 호출] 스케줄러가 고를 수 있는 대상이 된다',
      'RUNNABLE -> BLOCKED: [다른 스레드가 모니터 락을 쥐고 있다] `synchronized` 앞에서 멈춘다',
      'RUNNABLE -> WAITING: [wait 또는 join 호출] 깨워 줄 때까지 무기한 멈춘다',
      'RUNNABLE -> TIMED_WAITING: [sleep(n) 또는 wait(n) 호출] 정해진 시간만 멈춘다',
      'RUNNABLE -> TERMINATED: [run이 끝나거나 예외로 빠져나간다] 다시 시작할 수 없다',
      'BLOCKED -> RUNNABLE: [락을 얻는다] 다시 실행 대상이 된다',
      'WAITING -> RUNNABLE: [notify 또는 notifyAll] 깨어난다',
      'TIMED_WAITING -> RUNNABLE: [시간이 다 된다] 스스로 깨어난다',
      ':::',
    ].join('\n'),
  },
]

export default function Page() {
  return (
    <main className="mx-auto max-w-[720px] px-5 py-10">
      <h1 className="text-[22px] font-bold text-ink">상태 전이 시안</h1>

      <div className="mt-3 space-y-2 text-[14px] leading-[1.75] text-muted">
        <p>
          상태는 순서가 아니라 관계다. 되돌아가고, 여러 곳에서 한 곳으로 모이고, 조건이 붙는다.
          그것을 임의 그래프로 그리려면 노드를 2차원에 흩뿌리고 선을 이어야 하는데, 배치 계산이
          들어가는 순간 겹침과 삐침이 시작된다. 앞선 SVG 시안이 정확히 거기서 무너졌다.
        </p>
        <p>
          그래서 배치를 없앴다. 상태를 세로로 한 줄씩 세우고 나가는 길을 바로 아래 가지로 붙인다.
          세로는 나온 순서, 가로는 한 단뿐이라 계산할 좌표가 없다. 커넥터와 화살촉까지 전부
          CSS 테두리다.
        </p>
        <p>
          되돌아오는 선을 그리지 못하는 대신 도착 칩에 방향 표식을 준다. <span className="text-accent">↑</span>는
          앞에 나온 상태로 돌아감, <span className="text-faint">↓</span>는 아래로 이어짐,{' '}
          <span className="text-accent">↺</span>는 제자리다. 그리고 상태마다 <b>어디서 들어오는가</b>를
          머리에 적어 합류를 보이고, 나가는 길이 없는 상태에 <b>끝</b>을 붙여 자리를 준다. 둘 다
          지금 도식에는 없다.
        </p>
      </div>

      <p className="mt-4 rounded-md border border-line bg-raised px-3 py-2 text-[12.5px] leading-[1.6] text-faint">
        아래 칸은 폭을 390px로 묶어 두었다. 폰에서 보이는 그대로다.
      </p>

      {CASES.map((c) => {
        const blocks = parseBlocks(c.body)
        const block = blocks[0]

        return (
          <section key={c.title} className="mt-10">
            <h2 className="text-[16px] font-semibold text-ink">{c.title}</h2>
            <p className="mt-1 text-[13.5px] leading-[1.6] text-muted">{c.lead}</p>

            <div className="mt-3 w-full max-w-[390px] overflow-hidden">
              {block?.type === 'state' ? (
                <StateProto steps={block.steps} />
              ) : (
                <p className="my-6 rounded-md border border-warn bg-warn-soft px-3 py-2 text-[13px] text-warn">
                  파서가 상태 블록으로 안 읽었다. 나온 것: {block?.type ?? '없음'}
                </p>
              )}
            </div>
          </section>
        )
      })}
    </main>
  )
}
