import { describe, expect, it } from 'vitest'
import { transactionFrames, type FlowOptions } from '@/components/study-poc/transaction-flow'

const variants: FlowOptions[] = [2, 3].flatMap((pool) => ['same', 'different'].flatMap((rows) => ['COMMIT', 'ROLLBACK'].map((ending) => ({ pool, rows, ending } as FlowOptions))))
describe('connected transaction teaching model', () => {
  for (const options of variants) it(`keeps lock, transaction and borrowed connection boundaries for ${JSON.stringify(options)}`, () => {
    const frames = transactionFrames(options)
    expect(frames).toHaveLength(13)
    for (const frame of frames) {
      expect(new Set(frame.locks.map((lock) => lock.row)).size).toBe(frame.locks.length)
      const borrowed = frame.connections.filter((connection) => connection.request)
      expect(new Set(borrowed.map((connection) => connection.request)).size).toBe(borrowed.length)
      for (const lock of frame.locks) {
        const owner = borrowed.find((connection) => connection.request === lock.owner)
        expect(owner?.transaction).toBe('open'); expect(owner?.state).toBe('holding'); expect(owner?.row).toBe(lock.row)
      }
      for (const connection of frame.connections) {
        if (connection.state === 'lock-wait') {
          expect(connection.transaction).toBe('open'); expect(connection.pendingValue).toBeNull()
          expect(frame.locks.some((lock) => lock.row === connection.row && lock.owner !== connection.request)).toBe(true)
        }
        if (connection.state === 'idle') expect(connection.request).toBeNull()
      }
      for (const waiting of frame.poolQueue) expect(borrowed.some((connection) => connection.request === waiting)).toBe(false)
    }
    const updateDone = frames[2]
    expect(updateDone.committed[7]).toBe(0)
    expect(updateDone.connections[0]).toMatchObject({ state: 'holding', transaction: 'open', pendingValue: 1 })
    const ended = frames[6]
    expect(ended.connections[0]).toMatchObject({ id: 'C1', request: 'R1', state: 'ended', transaction: 'ended' })
    expect(ended.locks.some((lock) => lock.owner === 'R1')).toBe(false)
    expect(ended.committed[7]).toBe(options.ending === 'COMMIT' ? 1 : 0)
    expect(frames[7].connections[0]).toMatchObject({ id: 'C1', request: null, state: 'idle', created: true })
    const last = frames.at(-1)!
    expect(last.locks).toEqual([]); expect(last.poolQueue).toEqual([])
    expect(last.connections.every((connection) => connection.state === 'idle')).toBe(true)
    expect(last.committed[7]).toBe(options.rows === 'same' ? options.ending === 'COMMIT' ? 3 : 2 : options.ending === 'COMMIT' ? 1 : 0)
  })
  it('moves the third request from pool waiting to row-lock waiting when only the upper bound grows', () => {
    const two = transactionFrames({ pool: 2, rows: 'same', ending: 'COMMIT' })[5]
    const three = transactionFrames({ pool: 3, rows: 'same', ending: 'COMMIT' })[5]
    expect(two.poolQueue).toEqual(['R3'])
    expect(two.connections[1]).toMatchObject({ id: 'C2', request: 'R2', state: 'lock-wait' })
    expect(three.poolQueue).toEqual([])
    expect(three.connections[2]).toMatchObject({ id: 'C3', request: 'R3', state: 'lock-wait', transaction: 'open' })
    expect(three.locks).toEqual(two.locks)
    expect(transactionFrames({ pool: 3, rows: 'same', ending: 'COMMIT' })[0].connections[2].created).toBe(false)
  })
  it('keeps R3 waiting for the pool until release even after R1 commits and never labels different rows as that same row lock', () => {
    const frames = transactionFrames({ pool: 2, rows: 'different', ending: 'COMMIT' })
    expect(frames[5].connections[1].state).toBe('holding')
    expect(frames[6].poolQueue).toEqual(['R3'])
    expect(frames[7].poolQueue).toEqual(['R3'])
    expect(frames[8].connections[0]).toMatchObject({ request: 'R3', transaction: 'open', sql: 'BEGIN' })
    expect(frames[9].connections[0].state).toBe('holding')
    expect(frames.every((frame) => frame.connections.every((connection) => connection.state !== 'lock-wait'))).toBe(true)
  })
})
