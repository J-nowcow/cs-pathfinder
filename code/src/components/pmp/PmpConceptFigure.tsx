import { EVM_DEFAULTS, calculateEvm, formatEvm } from '@/lib/pmp/evm'

/** Original vector explanations of the authored course; no client runtime. */
export function PmpConceptFigure({ lesson }: { lesson: string }) {
  if (lesson === 'n01') return <SuccessFigure />
  if (lesson === 'n35') return <EvmFigure />
  if (lesson === 'n27') return <RiskFigure />
  return null
}

function SuccessFigure() {
  return (
    <figure
      className="lesson-concept-figure"
      aria-labelledby="success-figure-caption"
    >
      <figcaption id="success-figure-caption">
        <span className="lesson-eyebrow">그림으로 이해하기</span>
        <strong>만든 것과 달라진 것, 얻은 가치를 나누어 봅니다</strong>
      </figcaption>
      <div className="lesson-figure-canvas">
        <svg
          viewBox="0 0 760 270"
          role="img"
          aria-labelledby="success-svg-title"
          aria-describedby="success-svg-desc"
        >
          <title id="success-svg-title">예약 화면의 산출물·성과·편익</title>
          <desc id="success-svg-desc">
            예약 화면을 만든 것은 산출물입니다. 고객의 실제 사용은 성과로
            확인하고 기다림이 줄어드는지는 편익으로 측정합니다. 배포만으로
            성과와 편익이 보장되지는 않습니다.
          </desc>
          <g className="figure-line">
            <rect x="35" y="28" width="160" height="105" rx="10" />
            <path d="M35 53h160M54 42h3m9 0h3m9 0h3M58 76h40m-40 18h64m-64 18h84" />
            <rect
              x="146"
              y="76"
              width="26"
              height="36"
              rx="4"
              className="figure-accent-fill"
            />
            <circle cx="358" cy="61" r="20" />
            <path d="M323 122v-9a35 35 0 0 1 70 0v9M407 76l10 10 20-23" />
            <circle cx="640" cy="80" r="46" />
            <path d="M640 49v31l22 13M584 41l-11 21h24" />
            <path
              d="M226 82h61m-9-7 9 7-9 7M465 82h61m-9-7 9 7-9 7"
              className="figure-dashed"
            />
          </g>
          <g className="figure-label" textAnchor="middle">
            <text x="115" y="174">
              산출물
            </text>
            <text x="380" y="174">
              성과
            </text>
            <text x="640" y="174">
              편익
            </text>
          </g>
          <g className="figure-small" textAnchor="middle">
            <text x="115" y="204">
              예약 화면을 만듦
            </text>
            <text x="380" y="204">
              고객이 실제로 사용
            </text>
            <text x="640" y="204">
              기다림이 줄어듦
            </text>
            <text x="115" y="238">
              Output
            </text>
            <text x="380" y="238">
              Outcome
            </text>
            <text x="640" y="238">
              Benefit
            </text>
          </g>
        </svg>
      </div>
      <p className="lesson-figure-note">
        예약 서비스의 가상 예시입니다. 배포 뒤에도 사용과 편익을 따로 확인해야
        합니다.
      </p>
    </figure>
  )
}

function EvmFigure() {
  const { pv, ev, ac } = EVM_DEFAULTS
  const result = calculateEvm(EVM_DEFAULTS)!
  const rows = [
    { key: 'PV', label: '계획한 일의 가치', value: pv },
    { key: 'EV', label: '완료한 일의 가치', value: ev },
    { key: 'AC', label: '실제로 쓴 비용', value: ac },
  ]
  const scale = 420 / Math.max(pv, ev, ac)
  return (
    <figure
      className="lesson-concept-figure"
      aria-labelledby="evm-figure-caption"
    >
      <figcaption id="evm-figure-caption">
        <span className="lesson-eyebrow">그림으로 이해하기</span>
        <strong>같은 EV를 무엇과 비교하느냐가 다릅니다</strong>
      </figcaption>
      <div className="lesson-figure-canvas">
        <svg
          viewBox="0 0 760 260"
          role="img"
          aria-labelledby="evm-svg-title"
          aria-describedby="evm-svg-desc"
        >
          <title id="evm-svg-title">PV·EV·AC의 같은 기준 비교</title>
          <desc id="evm-svg-desc">
            같은 날짜와 가상 예산 단위에서 PV {pv}, EV {ev}, AC {ac}입니다.
            CPI는 EV를 AC로 나눈 {formatEvm(result.cpi)}, SPI는 EV를 PV로 나눈{' '}
            {formatEvm(result.spi)}입니다. SPI는 날짜 지연 비율이 아닙니다.
          </desc>
          <path d="M245 25v215" className="figure-line" />
          {rows.map((row, i) => (
            <g key={row.key} data-evm-figure={row.key} data-value={row.value}>
              <text x="15" y={55 + i * 78} className="figure-label">
                {row.key}
              </text>
              <text x="15" y={80 + i * 78} className="figure-small">
                {row.label}
              </text>
              <rect
                x="245"
                y={35 + i * 78}
                width={420}
                height="34"
                rx="5"
                className="figure-bar-track"
              />
              <rect
                x="245"
                y={35 + i * 78}
                width={row.value * scale}
                height="34"
                rx="5"
                className={'figure-bar figure-bar-' + row.key.toLowerCase()}
              />
              <text
                x="715"
                y={60 + i * 78}
                className="figure-label"
                textAnchor="end"
              >
                {row.value}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="lesson-figure-comparison">
        <p>
          <strong>CPI = EV ÷ AC = {formatEvm(result.cpi)}</strong>
          <span>완료한 가치와 실제 원가를 비교</span>
        </p>
        <p>
          <strong>SPI = EV ÷ PV = {formatEvm(result.spi)}</strong>
          <span>완료한 가치와 계획한 가치를 비교</span>
        </p>
      </div>
      <p className="lesson-figure-note">
        본문과 같은 가상 예산 단위입니다. SPI 0.8을 날짜가 20% 늦었다는 뜻으로
        읽지 않습니다.
      </p>
    </figure>
  )
}

function RiskFigure() {
  return (
    <figure
      className="lesson-concept-figure"
      aria-labelledby="risk-figure-caption"
    >
      <figcaption id="risk-figure-caption">
        <span className="lesson-eyebrow">그림으로 이해하기</span>
        <strong>사건의 가능성과 목표에 미치는 영향을 나누어 봅니다</strong>
      </figcaption>
      <div className="lesson-figure-canvas">
        <svg
          viewBox="0 0 760 300"
          role="img"
          aria-labelledby="risk-svg-title"
          aria-describedby="risk-svg-desc"
        >
          <title id="risk-svg-title">원인·사건·영향과 남은 위험의 재확인</title>
          <desc id="risk-svg-desc">
            원인과 조건은 불확실한 사건으로 이어질 수 있고 사건은 목표에 영향을
            줄 수 있습니다. 대응할 때 발생 가능성과 영향을 나누어 보고 남은
            위험을 다시 확인합니다. 전가 후에도 실행 책임은 확인해야 합니다.
          </desc>
          <g className="figure-line">
            <path d="M72 48h62v70H72zM90 69h26m-26 18h26m-26 18h17" />
            <path d="M164 90h135m-10-7 10 7-10 7M461 90h128m-10-7 10 7-10 7" />
            <path
              d="m380 28 62 62-62 62-62-62Z"
              className="figure-accent-fill"
            />
            <path d="M625 124V54m0 70h74M643 108V91m22 17V76m22 32V58" />
            <path
              d="M625 207v40H103v-40m-7 10 7-10 7 10"
              className="figure-dashed"
            />
          </g>
          <text x="380" y="101" textAnchor="middle" className="figure-question">
            ?
          </text>
          <g className="figure-label" textAnchor="middle">
            <text x="103" y="170">
              원인·조건
            </text>
            <text x="380" y="186">
              불확실한 사건
            </text>
            <text x="657" y="170">
              목표에 미치는 영향
            </text>
          </g>
          <g className="figure-small" textAnchor="middle">
            <text x="225" y="54">
              발생 가능성
            </text>
            <text x="525" y="54">
              영향
            </text>
            <text x="380" y="278">
              대응 뒤에도 남은 위험을 다시 확인
            </text>
          </g>
        </svg>
      </div>
      <p className="lesson-figure-note">
        전가를 선택해도 남은 위험과 실행 책임을 계속 확인합니다.
      </p>
    </figure>
  )
}
