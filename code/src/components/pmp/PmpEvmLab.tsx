'use client'
import { useEffect, useState } from 'react'
import {
  calculateEvm,
  EVM_DEFAULTS,
  formatEvm,
  parseEvmAmount,
  type EvmInput,
} from '@/lib/pmp/evm'
const fields = (value: EvmInput) =>
  Object.fromEntries(
    Object.entries(value).map(([key, number]) => [
      key,
      number === null ? '' : String(number),
    ]),
  )
const inputs = [
  ['bac', 'BAC · 전체 예산'],
  ['pv', 'PV · 계획 가치'],
  ['ev', 'EV · 획득 가치'],
  ['ac', 'AC · 실제 원가'],
  ['etc', '새로 추정한 잔여 원가 ETC (선택)'],
] as const
const presets = [
  { label: '기본 예제', input: EVM_DEFAULTS },
  { label: '지출만 70으로', input: { ...EVM_DEFAULTS, ac: 70 } },
  { label: '계획 가치가 0이면', input: { ...EVM_DEFAULTS, pv: 0 } },
  { label: '아직 지출이 없다면', input: { ...EVM_DEFAULTS, ac: 0 } },
  { label: '전체 예산을 썼다면', input: { ...EVM_DEFAULTS, ac: 100 } },
  {
    label: '가치 기준으로 모두 완료',
    input: { ...EVM_DEFAULTS, pv: 100, ev: 100, ac: 120, etc: 0 },
  },
]
export function PmpEvmLab() {
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState(() => fields(EVM_DEFAULTS))
  useEffect(() => setReady(true), [])
  const parsed = Object.fromEntries(
    inputs.map(([key]) => [key, parseEvmAmount(input[key])]),
  )
  const core = ['bac', 'pv', 'ev', 'ac'] as const
  const valid =
    core.every((key) => parsed[key] !== null) &&
    (input.etc.trim() === '' || parsed.etc !== null)
  const result = valid ? calculateEvm(parsed as EvmInput) : null
  const values = parsed as EvmInput
  const metrics = result
    ? [
        {
          name: 'CPI · 비용 효율',
          value: result.cpi,
          formula: 'EV / AC',
          note:
            result.cpi === null
              ? 'AC가 0이라 나눌 수 없습니다.'
              : result.cpi < 1
                ? '획득 가치보다 실제 원가가 큽니다.'
                : result.cpi === 1
                  ? '획득 가치와 실제 원가가 같습니다.'
                  : '실제 원가보다 획득 가치가 큽니다.',
        },
        {
          name: 'SPI · 계획 대비 획득가치',
          value: result.spi,
          formula: 'EV / PV',
          note:
            result.spi === null
              ? 'PV가 0이라 나눌 수 없습니다.'
              : result.spi < 1
                ? '계획 가치만큼 일을 완료하지 못했습니다.'
                : result.spi === 1
                  ? '계획 가치만큼 일을 완료했습니다.'
                  : '계획 가치보다 많은 일을 완료했습니다.',
        },
        {
          name: 'CV · 비용 편차',
          value: result.cv,
          formula: 'EV − AC',
          note: '단위는 입력한 가상 예산 단위입니다.',
        },
        {
          name: 'SV · 일정 편차',
          value: result.sv,
          formula: 'EV − PV',
          note: '금액으로 표현한 편차이며 지연 일수가 아닙니다.',
        },
      ]
    : []
  return (
    <section id="evm-lab" className="pmp-evm-lab" aria-labelledby="evm-title">
      <p className="study-meta">직접 비교하는 비용과 진척</p>
      <h2 id="evm-title">실적은 같은데, 예상 총원가는 왜 다를까요?</h2>
      <p>
        같은 기준일과 가상 예산 단위를 사용합니다. EV는 완료한 일의 예산
        가치이며 매출이나 지출액이 아닙니다.
      </p>
      <div className="pmp-evm-inputs">
        {inputs.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              inputMode="decimal"
              min={key === 'bac' ? '0.01' : '0'}
              max="100000000"
              step="0.01"
              value={input[key]}
              disabled={!ready}
              aria-invalid={
                key === 'etc' && input.etc.trim() === ''
                  ? false
                  : parsed[key] === null ||
                    (key === 'bac' && parsed.bac === 0) ||
                    ((key === 'pv' || key === 'ev') &&
                      parsed.bac !== null &&
                      parsed[key]! > parsed.bac)
              }
              aria-describedby="evm-input-help"
              onChange={(event) =>
                setInput({ ...input, [key]: event.target.value })
              }
            />
          </label>
        ))}
      </div>
      <div
        className="pmp-evm-presets"
        role="group"
        aria-label="기본값에서 시작하는 성과가치 실험"
      >
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={!ready}
            onClick={() => setInput(fields(preset.input))}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p id="evm-input-help" className="study-meta">
        0~1억, 소수 둘째 자리까지 입력합니다. BAC는 0보다 커야 하고 PV·EV는 BAC
        이하여야 합니다. 버튼은 모든 값을 예제로 재설정합니다. 입력은 저장하지
        않습니다.
      </p>
      <noscript>
        <p>
          JavaScript가 꺼져 있어 기본 예제의 계산과 가정을 표시합니다. 값을
          바꾸려면 JavaScript를 켜세요.
        </p>
      </noscript>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pmp-evm-status"
      >
        {result ? (
          <p>
            현재 효율 유지 가정의 EAC:{' '}
            <strong>{formatEvm(result.eacCpi)}</strong> · 남은 일의 예산 가치:{' '}
            {formatEvm(result.remaining)}
          </p>
        ) : (
          <p>
            BAC·PV·EV·AC와 선택한 ETC를 확인하세요. 빈 필수값·음수·범위
            초과·소수 셋째 자리 이하는 계산하지 않습니다. PV·EV는 BAC를 넘을 수
            없습니다.
          </p>
        )}
      </div>
      {result && (
        <>
          <figure className="pmp-evm-bars">
            <figcaption>같은 예산 가치로 비교하기</figcaption>
            {(['pv', 'ev', 'ac'] as const).map((key) => (
              <div key={key}>
                <span>{key.toUpperCase()}</span>
                <span className="pmp-evm-track" aria-hidden="true">
                  <i
                    style={{
                      width: `${(values[key] / Math.max(values.bac, values.ac)) * 100}%`,
                    }}
                  />
                </span>
                <strong>{formatEvm(values[key])}</strong>
              </div>
            ))}
            <p className="study-meta">
              공통 눈금의 최댓값은 BAC와 AC 중 큰 값입니다. PV·EV·AC의 단위는
              같습니다.
            </p>
          </figure>
          <div className="pmp-evm-metrics">
            {metrics.map((metric) => (
              <div key={metric.name}>
                <h3>{metric.name}</h3>
                <strong>{formatEvm(metric.value)}</strong>
                <p>
                  <code>{metric.formula}</code>
                </p>
                <p>{metric.note}</p>
              </div>
            ))}
          </div>
          <p>
            SPI와 SV만으로 준공일이나 지연 일수를 알 수 없습니다. SPI가 1
            이상이어도 임계 작업이 늦을 수 있으므로{' '}
            <a href="/learn/pmp/n44#float-lab">일정과 임계 경로</a>를 함께
            확인합니다.
          </p>
          <h3>남은 일의 비용을 어떻게 볼까요?</h3>
          <div className="pmp-evm-forecasts">
            <section>
              <h4>지금의 비용 효율이 유지된다면</h4>
              <p className="pmp-evm-value">EAC {formatEvm(result.eacCpi)}</p>
              <p>
                <code>BAC / CPI</code>
              </p>
              <p>
                {result.eacCpi === null ? (
                  'AC가 0이거나 CPI가 0이라 이 가정의 예측을 계산하지 않습니다.'
                ) : (
                  <>
                    남은 원가 ETC는 {formatEvm(result.etcCpi)}, 완료 시 편차
                    VAC는 {formatEvm(result.vacCpi)}입니다. VAC=BAC−EAC이며
                    음수면 예상 총원가가 예산보다 큽니다.
                  </>
                )}
              </p>
            </section>
            <section>
              <h4>남은 일을 원래 계획한 효율로 한다면</h4>
              <p className="pmp-evm-value">EAC {formatEvm(result.eacPlan)}</p>
              <p>
                <code>AC + (BAC − EV)</code>
              </p>
              <p>
                이미 생긴 편차는 남기고 잔여 작업의 비용 효율을 1로 가정합니다.
                앞의 CPI 유지 가정과 구분해서 선택합니다.
              </p>
            </section>
            <section>
              <h4>잔여 원가를 새로 추정했다면</h4>
              <p className="pmp-evm-value">
                EAC {formatEvm(result.eacBottomUp)}
              </p>
              <p>
                <code>AC + 새 ETC</code>
              </p>
              <p>
                {result.eacBottomUp === null
                  ? '선택 입력란에 새로 추정한 잔여 원가 ETC를 넣어 비교하세요.'
                  : '새 ETC는 현재까지 쓴 원가를 제외하고 앞으로 필요한 원가입니다. 이미 쓴 AC를 두 번 더하지 않습니다.'}
              </p>
            </section>
          </div>
          <section className="pmp-evm-target">
            <h3>원래 예산 BAC 안에서 끝내려면</h3>
            <p className="pmp-evm-value">
              TCPI → BAC {formatEvm(result.tcpiBac)}
            </p>
            <p>
              <code>(BAC − EV) / (BAC − AC)</code>
            </p>
            <p>
              {result.remaining === 0
                ? 'EV=BAC로 남은 일의 예산 가치가 0입니다. TCPI를 남은 작업의 성과 요구로 해석하지 않습니다. 미지급 원가와 완료 판정도 확인하세요.'
                : result.tcpiBac === null
                  ? 'BAC−AC가 0 이하입니다. 남은 예산으로 잔여 작업을 나누는 TCPI는 표시하지 않습니다. 예산 목표와 잔여 원가를 다시 검토하세요.'
                  : 'CPI는 지금까지의 효율이고 TCPI는 앞으로 필요한 효율입니다. TCPI가 1보다 크면 남은 예산 1당 그보다 큰 예산 가치의 일을 해내야 합니다. 달성 가능성을 보장하지 않습니다.'}
            </p>
          </section>
          <details>
            <summary>기본 예제와 대조하기</summary>
            <p>
              BAC=100, PV=50, EV=40, AC=50이면 CPI=SPI=0.8, CV=SV=−10입니다.
              현재 효율 유지의 EAC는 125, 잔여 효율 1 가정은 110입니다. 새 ETC가
              70이면 EAC는 120입니다. BAC 목표의 TCPI는 60/50=1.2입니다.
            </p>
            <p>
              이 예측들은 확정 결과나 신뢰구간이 아닙니다. 범위·기준일·진척
              측정·미반영 원가를 확인한 뒤 원인에 맞는 가정을 선택합니다.
            </p>
          </details>
          <p className="study-meta">
            표시는 최대 6자리 유효숫자로 반올림하며 계산에는 반올림 전 값을
            씁니다. 공식을 적용할 수 없는 값은 ‘계산 불가’로 표시합니다.
          </p>
        </>
      )}
      <p className="study-meta">
        참고:{' '}
        <a
          href="https://www.pmi.org/blog/earned-value-management"
          target="_blank"
          rel="noopener noreferrer"
        >
          PMI EVM 설명
        </a>{' '}
        (2026.08.31),{' '}
        <a
          href="https://www.pmi.org/learning/library/make-earned-value-work-project-6001"
          target="_blank"
          rel="noopener noreferrer"
        >
          Lukas·PMI Congress
        </a>{' '}
        (2012.10.23),{' '}
        <a
          href="https://www.nsf.gov/od/ori/evm-gold-card"
          target="_blank"
          rel="noopener noreferrer"
        >
          NSF EVM Gold Card
        </a>{' '}
        (게시일 미표기). 2026.10.28 원문 확인. 기초 원리 참고이며 시험 출제나
        정책을 보장하지 않습니다. 가상 실험은 자체 제작했습니다.
      </p>
    </section>
  )
}
