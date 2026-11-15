/** A finite teaching sequence, separate from the persisted experiment model. */
export const INTRO_SAMPLE = { table: 'counters', id: 7, value: 0 } as const
export const INTRO_SELECT = `SELECT value FROM ${INTRO_SAMPLE.table} WHERE id = ${INTRO_SAMPLE.id}`
export type ConnectionState = 'absent' | 'opening' | 'idle' | 'busy' | 'held'
export type IntroFrame = {
  caption: string
  connection: ConnectionState
  requests: readonly { id: 'R1' | 'R2'; state: 'new' | 'waiting' | 'using' | 'done' }[]
  sql: 'R1' | 'R2' | null
  result?: 'R1' | 'R2'
  borrower?: 'R1' | 'R2'
}
export const INTRO_CHAPTERS: readonly { title: string; note: string; frames: readonly IntroFrame[] }[] = [
  {
    title: 'DB 연결',
    note: '연결을 열면 앱과 DB가 명령과 결과를 주고받을 수 있습니다.',
    frames: [
      { caption: 'R1은 저장된 숫자를 읽으려는 앱의 첫 조회 요청입니다.', connection: 'absent', requests: [{ id: 'R1', state: 'new' }], sql: null },
      { caption: '앱이 DB에 연결하고 인증합니다.', connection: 'opening', requests: [{ id: 'R1', state: 'new' }], sql: null },
      { caption: '앱과 DB 사이의 연결 C1이 준비되어 SQL을 보낼 수 있습니다.', connection: 'idle', requests: [{ id: 'R1', state: 'new' }], sql: null },
      { caption: 'R1이 C1을 빌려 SQL을 보내면 DB가 실행합니다.', connection: 'busy', borrower: 'R1', requests: [{ id: 'R1', state: 'using' }], sql: 'R1' },
      { caption: '조회 결과를 받은 뒤에도 앱은 C1을 사용 중입니다.', connection: 'held', result: 'R1', borrower: 'R1', requests: [{ id: 'R1', state: 'using' }], sql: null },
      { caption: '앱이 반납한 C1은 열린 채 다음 사용을 기다립니다.', connection: 'idle', requests: [{ id: 'R1', state: 'done' }], sql: null },
    ],
  },
  {
    title: '같은 연결 재사용',
    note: '커넥션 풀은 반납된 연결을 보관하고 다음 요청에 빌려줍니다.',
    frames: [
      { caption: 'R1이 끝난 뒤에도 연결 C1은 풀에 남아 있습니다.', connection: 'idle', requests: [{ id: 'R1', state: 'done' }], sql: null },
      { caption: '다음 요청 R2가 DB 조회를 하려고 합니다.', connection: 'idle', requests: [{ id: 'R1', state: 'done' }, { id: 'R2', state: 'new' }], sql: null },
      { caption: 'R2는 새 연결을 여는 절차를 거치지 않고 같은 C1로 SQL을 보냅니다.', connection: 'busy', borrower: 'R2', requests: [{ id: 'R1', state: 'done' }, { id: 'R2', state: 'using' }], sql: 'R2' },
      { caption: 'R2도 조회 결과를 받았으며 C1을 아직 사용 중입니다.', connection: 'held', borrower: 'R2', result: 'R2', requests: [{ id: 'R1', state: 'done' }, { id: 'R2', state: 'using' }], sql: null },
      { caption: 'SQL이 끝나고 앱이 C1을 반납하면 다시 사용할 수 있습니다.', connection: 'idle', requests: [{ id: 'R1', state: 'done' }, { id: 'R2', state: 'done' }], sql: null },
    ],
  },
  {
    title: '모두 사용 중이면 대기',
    note: '연결이 최대 1개인 새 예시입니다.',
    frames: [
      { caption: 'R1이 C1을 사용 중으로, 풀의 상한인 1개를 모두 쓰고 있습니다.', connection: 'busy', borrower: 'R1', requests: [{ id: 'R1', state: 'using' }], sql: 'R1' },
      { caption: 'R2는 빌릴 연결이 없어 앱에서 기다립니다.', connection: 'busy', borrower: 'R1', requests: [{ id: 'R1', state: 'using' }, { id: 'R2', state: 'waiting' }], sql: 'R1' },
      { caption: 'R1이 조회 결과를 받아도 C1을 반납하기 전까지 R2는 기다립니다.', connection: 'held', result: 'R1', borrower: 'R1', requests: [{ id: 'R1', state: 'using' }, { id: 'R2', state: 'waiting' }], sql: null },
      { caption: 'R1이 C1을 반납하여 다음 요청에 빌려줄 수 있습니다.', connection: 'idle', requests: [{ id: 'R1', state: 'done' }, { id: 'R2', state: 'waiting' }], sql: null },
      { caption: '기다리던 R2가 C1을 빌려 SQL을 실행합니다.', connection: 'busy', borrower: 'R2', requests: [{ id: 'R1', state: 'done' }, { id: 'R2', state: 'using' }], sql: 'R2' },
      { caption: 'R2가 조회 결과를 받았으며 C1을 아직 사용 중입니다.', connection: 'held', borrower: 'R2', result: 'R2', requests: [{ id: 'R1', state: 'done' }, { id: 'R2', state: 'using' }], sql: null },
      { caption: 'R2도 작업을 마치고 C1을 반납했습니다.', connection: 'idle', requests: [{ id: 'R1', state: 'done' }, { id: 'R2', state: 'done' }], sql: null },
    ],
  },
]

export type IntroPosition = { chapter: number; frame: number }
export function advanceIntro(position: IntroPosition, direction: -1 | 1): IntroPosition {
  const chapter = INTRO_CHAPTERS[position.chapter]
  if (direction === 1) {
    if (position.frame < chapter.frames.length - 1) return { ...position, frame: position.frame + 1 }
    if (position.chapter < INTRO_CHAPTERS.length - 1) return { chapter: position.chapter + 1, frame: 0 }
  } else {
    if (position.frame > 0) return { ...position, frame: position.frame - 1 }
    if (position.chapter > 0) return { chapter: position.chapter - 1, frame: INTRO_CHAPTERS[position.chapter - 1].frames.length - 1 }
  }
  return position
}
