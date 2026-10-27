import { certificate as c } from '@/lib/certificate/course'

export function CertificateCidrFigure() {
  const n = c.cidrExample
  const fixed = n.prefix % 8
  return (
    <figure className="certificate-cidr-figure">
      <figcaption>앞 24비트는 192.0.2 · 마지막 8비트에서 나누기</figcaption>
      <div className="certificate-cidr-byte">
        <div>
          <span>접두사의 나머지 {fixed}비트</span>
          <strong>{n.lastOctetBits.slice(0, fixed)}</strong>
        </div>
        <div>
          <span>호스트 {n.hostBits}비트</span>
          <strong>{n.lastOctetBits.slice(fixed)}</strong>
        </div>
      </div>
      <p>
        마지막 바이트 40은 {n.lastOctetBits}입니다. 접두사 비트는 그대로 두고
        호스트 비트를 모두 0으로 놓으면 .0, 모두 1로 놓으면 .63입니다. 양 끝을
        포함해 {n.totalAddresses}주소가 됩니다.
      </p>
    </figure>
  )
}
