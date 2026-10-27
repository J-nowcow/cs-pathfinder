import { describe, it, expect } from 'vitest'
import {
  readCertificate,
  changeCertificate,
  saveCertificate,
  mergeCertificate,
  CERTIFICATE_KEY,
} from '@/lib/certificate/storage'
import { readLibraryProgress } from '@/lib/library/progress'
const at = new Date('2026-10-27T16:00:00.000Z')
describe('독립 정처기 기록과 통합 서재', () => {
  it('다른 분야 키를 건드리지 않고 최신 점검을 합쳐 쓰며 같은 메모 충돌은 막는다', () => {
    const raw: Record<string, string> = {
        'pmp-pathfinder-v1': 'keep-pmp',
        'pathfinder.library.v1': 'keep-library',
      },
      storage = {
        getItem: (k: string) => raw[k] ?? null,
        setItem: (k: string, v: string) => {
          raw[k] = v
        },
      }
    saveCertificate(storage, 'keys', {
      kind: 'draft',
      text: '내 설명',
      expected: '',
    })
    saveCertificate(storage, 'joins', {
      kind: 'draft',
      text: '다른 수업',
      expected: '',
    })
    saveCertificate(storage, 'keys', {
      kind: 'check',
      value: '개념의 기준을 설명했다',
      checked: true,
    })
    saveCertificate(storage, 'keys', {
      kind: 'check',
      value: '예시와 예외를 구분했다',
      checked: true,
    })
    expect(
      readCertificate(raw[CERTIFICATE_KEY]).entries.keys.checks,
    ).toHaveLength(2)
    expect(() =>
      saveCertificate(storage, 'keys', {
        kind: 'draft',
        text: '오래된 탭',
        expected: '',
      }),
    ).toThrow('다른 탭')
    expect(readCertificate(raw[CERTIFICATE_KEY]).entries.keys.draft).toBe(
      '내 설명',
    )
    expect(raw['pmp-pathfinder-v1']).toBe('keep-pmp')
    expect(raw['pathfinder.library.v1']).toBe('keep-library')
  })
  it('손상 기록과 미래 버전을 빈 기록으로 바꿔 저장하지 않는다', () => {
    for (const raw of [
      '{',
      '{"version":2,"entries":{}}',
      '{"version":1,"entries":{"unknown":{}}}',
    ]) {
      let value = raw
      expect(() =>
        saveCertificate(
          {
            getItem: () => value,
            setItem: (_, v) => {
              value = v
            },
          },
          'keys',
          { kind: 'visit' },
        ),
      ).toThrow()
      expect(value).toBe(raw)
    }
    expect(() =>
      changeCertificate(
        readCertificate(null),
        'keys',
        { kind: 'draft', text: 'x'.repeat(6001), expected: '' },
        at,
      ),
    ).toThrow()
  })
  it('이동은 메모 수정 시각과 복습 날짜를 바꾸지 않는다', () => {
    let s = changeCertificate(
      readCertificate(null),
      'keys',
      { kind: 'draft', text: '기준 설명', expected: '' },
      at,
    )
    s = changeCertificate(s, 'keys', { kind: 'review', interval: 1 }, at)
    const visited = changeCertificate(
      s,
      'keys',
      { kind: 'visit' },
      new Date('2026-10-28T16:00:00.000Z'),
    )
    expect(visited.entries.keys.updatedAt).toBe(at.toISOString())
    expect(visited.entries.keys.due).toBe('2026-10-29')
    const v = readLibraryProgress(
      {
        getItem: (k) =>
          k === CERTIFICATE_KEY ? JSON.stringify(visited) : null,
      },
      new Date('2026-10-29T02:00:00Z'),
    )
    expect(v.recent[0]).toMatchObject({
      track: '정처기',
      href: '/learn/certificate/keys',
      excerpt: '기준 설명',
    })
    expect(v.due[0].id).toBe('certificate:keys')
  })
  it('백업 병합은 다른 메모를 덮어쓰지 않고 충돌을 알린다', () => {
    const old = changeCertificate(
      readCertificate(null),
      'keys',
      { kind: 'draft', text: '현재 메모', expected: '' },
      at,
    )
    const incoming = changeCertificate(
      readCertificate(null),
      'keys',
      { kind: 'draft', text: '다른 메모', expected: '' },
      new Date(at.getTime() + 1000),
    )
    expect(mergeCertificate(old, incoming)).toEqual({
      state: old,
      conflicts: ['keys'],
    })
    expect(mergeCertificate(readCertificate(null), incoming).state).toEqual(
      incoming,
    )
    const same = changeCertificate(
      old,
      'keys',
      { kind: 'review', interval: 3 },
      new Date(at.getTime() + 1000),
    )
    expect(mergeCertificate(old, same).state).toEqual(same)
    const corrupt = JSON.parse(JSON.stringify(old))
    corrupt.entries.keys.due = '2026-02-31'
    expect(() => readCertificate(JSON.stringify(corrupt))).toThrow()
  })
})
