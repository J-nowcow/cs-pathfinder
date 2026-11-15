/** Deterministic teaching events, not a database or a latency model. */
export type FlowOptions = { pool: 2 | 3; rows: 'same' | 'different'; ending: 'COMMIT' | 'ROLLBACK' }
export type FlowRequestId = 'R1' | 'R2' | 'R3'
export type FlowConnection = {
  id: string
  created: boolean
  request: FlowRequestId | null
  transaction: 'none' | 'open' | 'ended'
  state: 'idle' | 'begin' | 'holding' | 'lock-wait' | 'ended'
  row: number | null
  sql: string
  pendingValue: number | null
}
export type FlowFrame = {
  title: string
  caption: string
  connections: FlowConnection[]
  poolQueue: FlowRequestId[]
  locks: { row: number; owner: FlowRequestId }[]
  committed: Record<number, number>
  r1Change: 'none' | 'pending' | 'committed' | 'rolled-back'
  transfer?: { request: FlowRequestId; kind: 'sql' | 'end' | 'release' }
}
export const DEFAULT_FLOW_OPTIONS: FlowOptions = { pool: 2, rows: 'same', ending: 'COMMIT' }
export const FLOW_CHECKPOINT = 5

export function transactionFrames(options: FlowOptions): FlowFrame[] {
  const { pool, rows, ending } = options
  if (![2, 3].includes(pool) || !['same', 'different'].includes(rows) || !['COMMIT', 'ROLLBACK'].includes(ending)) throw new Error('invalid_demo_options')
  const connections: FlowConnection[] = Array.from({ length: pool }, (_, index) => ({ id: `C${index + 1}`, created: false, pendingValue: null, request: null, transaction: 'none', state: 'idle', row: null, sql: '—' }))
  const poolQueue: FlowRequestId[] = []
  const locks: FlowFrame['locks'] = []
  const committed: Record<number, number> = { 7: 0, 8: 0, 9: 0 }
  let r1Change: FlowFrame['r1Change'] = 'none'
  const frames: FlowFrame[] = []
  const rowOf = (request: FlowRequestId) => rows === 'same' ? 7 : request === 'R1' ? 7 : request === 'R2' ? 8 : 9
  const connectionOf = (request: FlowRequestId) => connections.find((connection) => connection.request === request)!
  const snapshot = (title: string, caption: string, transfer?: FlowFrame['transfer']) => frames.push({ title, caption, connections: connections.map((connection) => ({ ...connection })), poolQueue: [...poolQueue], locks: locks.map((lock) => ({ ...lock })), r1Change, committed: { ...committed }, ...(transfer ? { transfer } : {}) })
  const begin = (request: FlowRequestId) => {
    const connection = connections.find((item) => item.state === 'idle')!
    Object.assign(connection, { request, created: true, pendingValue: null, transaction: 'open', state: 'begin', row: rowOf(request), sql: 'BEGIN' })
  }
  const update = (request: FlowRequestId) => {
    const connection = connectionOf(request)
    const row = rowOf(request)
    connection.sql = `UPDATE counters SET value = value + 1 WHERE id = ${row}`
    if (locks.some((lock) => lock.row === row && lock.owner !== request)) connection.state = 'lock-wait'
    else { connection.state = 'holding'; connection.pendingValue = committed[row] + 1; locks.push({ row, owner: request }) }
  }
  const end = (request: FlowRequestId, command = 'COMMIT') => {
    const connection = connectionOf(request)
    if (command === 'COMMIT' && connection.pendingValue !== null) committed[connection.row!] = connection.pendingValue
    connection.pendingValue = null
    connection.transaction = 'ended'; connection.state = 'ended'; connection.sql = command
    const lockIndex = locks.findIndex((lock) => lock.owner === request)
    if (lockIndex !== -1) locks.splice(lockIndex, 1)
    // Selected execution order for this example; PostgreSQL does not promise FIFO.
    const waiter = connections.find((item) => item.state === 'lock-wait' && !locks.some((lock) => lock.row === item.row))
    if (waiter) { waiter.state = 'holding'; waiter.pendingValue = committed[waiter.row!] + 1; locks.push({ row: waiter.row!, owner: waiter.request! }) }
  }
  const release = (request: FlowRequestId) => Object.assign(connectionOf(request), { request: null, transaction: 'none', state: 'idle', row: null, pendingValue: null, sql: '—' })

  snapshot('트랜잭션 시작 전', '이제 저장된 숫자를 1 늘리는 새 요청 3개를 살펴봅니다.')
  begin('R1')
  snapshot('BEGIN · 작업 묶음 시작', 'R1이 C1을 빌려 트랜잭션을 시작합니다.', { request: 'R1', kind: 'sql' })
  update('R1'); r1Change = 'pending'
  snapshot('UPDATE 완료 · 잠금 보유', 'R1이 7번 행의 값을 1 늘렸고, 트랜잭션이 끝날 때까지 잠금을 보유합니다.', { request: 'R1', kind: 'sql' })
  begin('R2')
  snapshot('두 번째 트랜잭션', 'R2가 C2를 빌려 별도의 트랜잭션을 시작합니다.', { request: 'R2', kind: 'sql' })
  update('R2')
  snapshot(rows === 'same' ? '같은 행의 UPDATE 대기' : '다른 행의 UPDATE 완료', rows === 'same' ? 'R2는 7번 행의 잠금을 기다리며 C2도 계속 사용합니다.' : 'R2는 8번 행을 수정하여 R1의 행 잠금을 기다리지 않습니다.', { request: 'R2', kind: 'sql' })
  if (pool === 2) poolQueue.push('R3')
  else { begin('R3'); update('R3') }
  snapshot('세 번째 요청 도착', pool === 2 ? 'R3는 빌릴 연결이 없어 앱에서 기다립니다.' : rows === 'same' ? 'R3는 C3를 빌렸지만 같은 7번 행의 잠금을 기다립니다.' : 'R3는 C3로 9번 행을 수정하여 다른 요청의 행 잠금을 기다리지 않습니다.', pool === 3 ? { request: 'R3', kind: 'sql' } : undefined)
  end('R1', ending); r1Change = ending === 'COMMIT' ? 'committed' : 'rolled-back'
  snapshot(`${ending} · R1의 잠금 해제`, `R1이 변경을 ${ending === 'COMMIT' ? '확정' : '취소'}하고 잠금을 ${rows === 'same' ? '풀면 R2의 UPDATE가 이어집니다' : '풉니다'}.`, { request: 'R1', kind: 'end' })
  release('R1')
  snapshot('C1을 풀에 반납', '앱이 C1을 반납하여 다음 요청에 빌려줄 수 있습니다.', { request: 'R1', kind: 'release' })
  if (pool === 2) { poolQueue.shift(); begin('R3') }
  snapshot('R3의 연결 확인', pool === 2 ? '기다리던 R3가 반납된 C1을 빌려 트랜잭션을 시작합니다.' : 'R3는 계속 C3를 사용하며 C1은 풀에서 기다립니다.', pool === 2 ? { request: 'R3', kind: 'sql' } : undefined)
  if (pool === 2) update('R3')
  snapshot('R3의 UPDATE', rows === 'same' ? 'R3는 R2가 보유한 7번 행의 잠금을 기다립니다.' : 'R3의 UPDATE는 다른 행을 수정하여 R2의 행 잠금을 기다리지 않습니다.', pool === 2 ? { request: 'R3', kind: 'sql' } : undefined)
  end('R2')
  snapshot('R2도 COMMIT', rows === 'same' ? '이 예시에서는 R2가 잠금을 풀면 R3의 UPDATE가 이어집니다.' : 'R2가 변경을 확정하고 8번 행의 잠금을 풉니다.', { request: 'R2', kind: 'end' })
  end('R3')
  snapshot('R3도 COMMIT', '모든 트랜잭션이 끝났으며 앱이 보유한 연결은 아직 남아 있습니다.', { request: 'R3', kind: 'end' })
  release('R2'); release('R3')
  snapshot('남은 연결 반납', '앱이 연결을 반납하여 풀에서 다시 빌려줄 수 있습니다.')
  return frames
}
