import { describe, expect, it } from 'vitest'
import { certificate as c } from '@/lib/certificate/course'
import {
  changeCertificate,
  mergeCertificate,
  readCertificate,
} from '@/lib/certificate/storage'
const value = (s: string) =>
  s.split('.').reduce((n, octet) => (n << 8n) + BigInt(octet), 0n)
const address = (n: bigint) =>
  [24n, 16n, 8n, 0n].map((shift) => Number((n >> shift) & 255n)).join('.')
describe('independent authored IPv4 example', () => {
  it('derives the published mask, boundaries, slots and non-overlapping four subnets using32-bit integer arithmetic', () => {
    const n = c.cidrExample
    const count = 1n << BigInt(32 - n.prefix)
    const mask = ((1n << 32n) - 1n) ^ (count - 1n)
    const first = value(n.input.split('/')[0]) & mask
    const last = first + count - 1n
    expect(n.hostBits).toBe(32 - n.prefix)
    expect(n.mask).toBe(address(mask))
    expect(n.network).toBe(address(first))
    expect(n.last).toBe(address(last))
    expect(n.firstHost).toBe(address(first + 1n))
    expect(n.lastHost).toBe(address(last - 1n))
    expect(n.totalAddresses).toBe(Number(count))
    expect(n.ordinaryLanHostSlots).toBe(Number(count - 2n))
    expect(n.lastOctetBits).toBe(
      Number(n.input.split('/')[0].split('.')[3]).toString(2).padStart(8, '0'),
    )
    expect(n.maskLastOctetBits).toBe(
      Number(n.mask.split('.')[3]).toString(2).padStart(8, '0'),
    )
    expect(n.networkLastOctetBits).toBe(
      Number(n.network.split('.')[3]).toString(2).padStart(8, '0'),
    )
    const parent = value(n.parent.split('/')[0])
    expect(n.subnets).toEqual(
      Array.from(
        { length: 4 },
        (_, i) => address(parent + BigInt(i) * count) + '/' + n.prefix,
      ),
    )
    expect(Number(count) * n.subnets.length).toBe(256)
    expect(n.ordinaryLanHostSlots * n.subnets.length).toBe(248)
    const rows = c.lessons.find((x) => x.id === 'ipv4-subnet')!.example.rows!
    expect(rows[1][1]).toBe(n.mask)
    expect(rows[2][1]).toBe(n.totalAddresses)
    expect(rows[3][1]).toBe(n.network + ' ~ ' + n.last)
    expect(rows[4][1]).toBe(n.firstHost + ' ~ ' + n.lastHost)
    expect(rows[5][1]).toBe(n.ordinaryLanHostSlots)
    const firstSubnetAddresses = Array.from({ length: 256 }, (_, i) =>
      value('192.0.2.' + i),
    ).filter((x) => (x & mask) === first)
    expect(firstSubnetAddresses).toHaveLength(64)
    expect(firstSubnetAddresses[0]).toBe(first)
    expect(firstSubnetAddresses.at(-1)).toBe(last)
  })
  it('preserves all fifteen existing records while adding a new-domain note and supports unchanged version1 backup/conflict rules', () => {
    const at = '2026-10-27T22:00:00.000Z'
    const entries = Object.fromEntries(
      c.lessons
        .filter((x) => x.domain !== 'network')
        .map((x) => [
          x.id,
          {
            draft: 'Synthetic legacy ' + x.id,
            checks: [...x.checklist],
            visitedAt: at,
            updatedAt: at,
            due: '2026-10-30',
          },
        ]),
    )
    expect(Object.keys(entries)).toHaveLength(15)
    const old = readCertificate(JSON.stringify({ version: 1, entries }))
    const next = changeCertificate(
      old,
      'ipv4-subnet',
      { kind: 'draft', text: 'Synthetic address note', expected: '' },
      new Date(at),
    )
    expect(
      Object.fromEntries(
        Object.entries(next.entries).filter(([id]) => id !== 'ipv4-subnet'),
      ),
    ).toEqual(old.entries)
    const backup = readCertificate(JSON.stringify(next))
    expect(mergeCertificate(old, backup).state).toEqual(next)
    const changed = changeCertificate(
      next,
      'ipv4-subnet',
      {
        kind: 'draft',
        text: 'Different local note',
        expected: 'Synthetic address note',
      },
      new Date(at),
    )
    expect(mergeCertificate(changed, backup).conflicts).toEqual(['ipv4-subnet'])
  })
})
