'use client'
import { useEffect, useRef, useState } from 'react'
import {
  CERTIFICATE_KEY,
  CERTIFICATE_EVENT,
  readCertificate,
  mergeCertificate,
} from '@/lib/certificate/storage'
import { libraryButton } from '@/components/library/LibraryShell'
export function CertificateBackup() {
  const [message, setMessage] = useState(''),
    [ready, setReady] = useState(false)
  const restoreSerial = useRef(0)
  useEffect(() => {
    setReady(true)
    return () => { restoreSerial.current++ }
  }, [])
  function backup() {
    try {
      const value = readCertificate(localStorage.getItem(CERTIFICATE_KEY))
      const u = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              { format: 'pathfinder.certificate.backup', ...value },
              null,
              2,
            ),
          ],
          { type: 'application/json' },
        ),
      )
      const a = document.createElement('a')
      a.href = u
      a.download = 'pathfinder-정처기-이론-기록.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(u), 1000)
      setMessage('정처기 메모·점검·복습 기록을 파일로 저장했어요.')
    } catch {
      setMessage(
        '기록을 읽지 못해 백업하지 않았어요. 브라우저 저장 설정을 확인해 주세요.',
      )
    }
  }
  async function restore(file?: File) {
    const token = ++restoreSerial.current
    if (!file) return
    try {
      if (file.size > 500000)
        throw Error('500KB 이하의 정처기 백업 파일을 골라 주세요.')
      const raw = await file.text()
      if (token !== restoreSerial.current) return
      const v = JSON.parse(raw)
      if (v.format !== 'pathfinder.certificate.backup')
        throw Error('이 화면에서 내보낸 정처기 백업 파일을 골라 주세요.')
      const incoming = readCertificate(raw),
        current = readCertificate(localStorage.getItem(CERTIFICATE_KEY)),
        result = mergeCertificate(current, incoming)
      if (result.conflicts.length)
        throw Error(
          '같은 수업에 서로 다른 메모가 있어 가져오지 않았어요. 현재 메모와 파일을 보관한 뒤 내용을 비교해 주세요.',
        )
      localStorage.setItem(CERTIFICATE_KEY, JSON.stringify(result.state))
      window.dispatchEvent(new Event(CERTIFICATE_EVENT))
      setMessage(
        '정처기 기록을 가져왔어요. 메모가 같은 항목의 점검·복습은 더 최근 기록을 사용했어요.',
      )
    } catch (e) {
      if (token !== restoreSerial.current) return
      setMessage(
        (e instanceof Error ? e.message : '파일을 확인해 주세요.') +
          ' 기존 기록은 그대로예요.',
      )
    }
  }
  return (
    <details className="desk-utility">
      <summary>정처기 기록 백업</summary>
      <p id="certificate-backup" tabIndex={-1}>
        이 이론 자료의 메모·점검·복습 날짜를 저장해요. 서로 다른 기존 메모가
        있으면 가져오기를 중단해요. 다른 분야의 기록은 각 백업 화면을
        이용하세요.
      </p>
      <div className="flex flex-wrap gap-3">
        <button className={libraryButton} disabled={!ready} onClick={backup}>
          정처기 기록 저장
        </button>
        <label className={libraryButton + ' cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent'}>
          정처기 기록 가져오기
          <input
            className="sr-only"
            type="file"
            disabled={!ready}
            accept="application/json,.json"
            onChange={(e) => {
              void restore(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <p role="status">{message}</p>
    </details>
  )
}
