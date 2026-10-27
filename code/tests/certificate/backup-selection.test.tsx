// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { CertificateBackup } from '@/components/certificate/CertificateBackup'
import {
  CERTIFICATE_KEY,
  readCertificate,
  changeCertificate,
} from '@/lib/certificate/storage'
function deferredFile() {
  let resolve!: (value: string) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<string>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { file: { size: 100, text: () => promise } as File, resolve, reject }
}
function payload(id: string) {
  const value = changeCertificate(
    readCertificate(null),
    id,
    { kind: 'draft', text: id, expected: '' },
    new Date('2026-10-27T00:00:00Z'),
  )
  return JSON.stringify({ format: 'pathfinder.certificate.backup', ...value })
}
function choose(container: HTMLElement, file: File) {
  fireEvent.change(container.querySelector('input[type=file]')!, {
    target: { files: [file] },
  })
}
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('pmp-pathfinder-v1', 'keep-pmp')
  localStorage.setItem('pathfinder.library.v1', 'keep-library')
})
afterEach(cleanup)
describe('certificate backup selection lifetime', () => {
  it('applies only the newest selection while keeping other record keys', async () => {
    const { container } = render(<CertificateBackup />)
    const first = deferredFile(),
      second = deferredFile()
    choose(container, first.file)
    choose(container, second.file)
    await act(async () => second.resolve(payload('joins')))
    await act(async () => first.resolve(payload('keys')))
    expect(
      Object.keys(
        readCertificate(localStorage.getItem(CERTIFICATE_KEY)).entries,
      ),
    ).toEqual(['joins'])
    expect(localStorage.getItem('pmp-pathfinder-v1')).toBe('keep-pmp')
    expect(localStorage.getItem('pathfinder.library.v1')).toBe('keep-library')
  })
  it('does not import after leaving the backup screen', async () => {
    const { container, unmount } = render(<CertificateBackup />)
    const file = deferredFile()
    choose(container, file.file)
    unmount()
    await act(async () => file.resolve(payload('keys')))
    expect(localStorage.getItem(CERTIFICATE_KEY)).toBeNull()
  })
  it('does not replace the latest success notice with an older read failure', async () => {
    const { container } = render(<CertificateBackup />)
    const first = deferredFile(),
      second = deferredFile()
    choose(container, first.file)
    choose(container, second.file)
    await act(async () => second.resolve(payload('joins')))
    const latest = container.querySelector('[role=status]')!.textContent
    await act(async () => first.reject(Error('synthetic read failure')))
    expect(container.querySelector('[role=status]')!.textContent).toBe(latest)
  })
})
