'use client'

import { useId, useState } from 'react'

/** Two exclusive resources; these are explanatory snapshots, not a DB simulator. */
export function DeadlockLab() {
  const [ordered, setOrdered] = useState(false)
  const marker = useId().replace(/:/g, '')
  return (
    <figure className="lock-lab">
      <div
        className="lock-switch"
        role="group"
        aria-label="잠금 획득 순서 비교"
      >
        <button
          type="button"
          aria-pressed={!ordered}
          onClick={() => setOrdered(false)}
        >
          서로 다른 순서
        </button>
        <button
          type="button"
          aria-pressed={ordered}
          onClick={() => setOrdered(true)}
        >
          같은 순서 A → B
        </button>
      </div>
      <div className="lock-diagram" aria-live="polite" aria-atomic="true">
        <svg
          viewBox="0 0 660 300"
          role="img"
          aria-label={
            ordered
              ? 'T1이 A와 B를 보유하고 T2만 T1을 기다린다. 대기의 순환이 없다.'
              : 'T1은 A를 보유하고 B를 기다린다. T2는 B를 보유하고 A를 기다린다. 서로 기다리는 순환이 생겼다.'
          }
        >
          <defs>
            <marker
              id={marker}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>
          <rect
            x="32"
            y="80"
            width="200"
            height="140"
            rx="20"
            className="lock-job-one"
          />
          <rect
            x="428"
            y="80"
            width="200"
            height="140"
            rx="20"
            className="lock-job-two"
          />
          <text x="132" y="117" textAnchor="middle" className="lock-job-title">
            T1 · 작업 1
          </text>
          <text x="528" y="117" textAnchor="middle" className="lock-job-title">
            T2 · 작업 2
          </text>
          <rect
            x="58"
            y="139"
            width="148"
            height="49"
            rx="10"
            className="lock-resource"
          />
          <rect
            x="454"
            y="139"
            width="148"
            height="49"
            rx="10"
            className="lock-resource"
          />
          <text x="132" y="170" textAnchor="middle" className="lock-held">
            {ordered ? 'A + B 보유' : 'A 보유'}
          </text>
          <text x="528" y="170" textAnchor="middle" className="lock-held">
            {ordered ? '보유 자원 없음' : 'B 보유'}
          </text>
          {!ordered && (
            <>
              <path
                d="M 232 120 C 285 34, 375 34, 428 120"
                className="lock-wait"
                markerEnd={`url(#${marker})`}
              />
              <text
                x="330"
                y="43"
                textAnchor="middle"
                className="lock-arrow-label"
              >
                B를 기다림 →
              </text>
            </>
          )}
          <path
            d="M 428 190 C 375 276, 285 276, 232 190"
            className="lock-wait"
            markerEnd={`url(#${marker})`}
          />
          <text
            x="330"
            y="284"
            textAnchor="middle"
            className="lock-arrow-label"
          >
            ← A를 기다림
          </text>
          <text x="330" y="151" textAnchor="middle" className="lock-verdict">
            {ordered ? '대기만 있음' : '교착상태'}
          </text>
          <text
            x="330"
            y="178"
            textAnchor="middle"
            className="lock-verdict-sub"
          >
            {ordered ? 'T1은 완료 가능' : '둘 다 진행 불가'}
          </text>
        </svg>
        <figcaption>
          <strong>
            {ordered
              ? '기다림이 있어도, 끝낼 수 있는 작업이 있다.'
              : '내가 놓아야 네가 끝나고, 네가 놓아야 내가 끝난다.'}
          </strong>
          <span>
            {ordered
              ? '둘 다 A부터 요청한 경우의 한 시점. T1이 A와 B를 얻었고 T2는 아무것도 잡지 않은 채 A를 기다립니다.'
              : '각자 하나를 잡은 채 상대의 자원을 요청한 시점. 점선 화살표는 자원의 이동이 아니라, 다른 작업을 기다리는 방향입니다.'}
          </span>
        </figcaption>
      </div>
      <p className="lock-assumption">
        그림의 조건: A·B는 각각 하나뿐인 배타적 자원이며 작업이 끝날 때 보유
        잠금을 해제합니다. 가상의 두 작업만 비교합니다.
      </p>
      <noscript>
        <p className="lock-assumption">
          순서 변경 비교는 JavaScript가 필요합니다. 같은 순서로 잡는 경우는
          아래의 실행 순서에서도 읽을 수 있습니다.
        </p>
      </noscript>
    </figure>
  )
}

function ConcurrencyCheck() {
  const [answer, setAnswer] = useState<number | null>(null)
  const replies = [
    '그림을 다시 보세요. T2는 기다리지만 T1은 B까지 얻어 끝낼 수 있습니다. 대기가 있다는 사실만으로 교착이라고 할 수는 없습니다.',
    '맞아요. 끝낼 수 있는 T1이 있으므로 이 시점에는 순환 대기가 없습니다. T1이 잠금을 해제하면 T2도 진행할 수 있습니다.',
    '잠금 획득 순서는 대기의 모양을 바꿉니다. 다만 데이터 정합성과 업무 규칙까지 보장하는지는 별도로 확인해야 합니다.',
  ]
  return (
    <section className="story-check" aria-labelledby="concurrency-check-title">
      <p className="story-kicker">잠깐, 내 말로 설명하기</p>
      <h3 id="concurrency-check-title">
        T2가 기다리고 있으면 무조건 교착일까?
      </h3>
      <div
        className="story-choices"
        role="group"
        aria-label="이해 확인 답 선택"
      >
        {[
          '그렇다. 기다리는 작업이 있으니까.',
          '아니다. T1이 끝낼 수 있는지 봐야 한다.',
          '잠금 순서는 결과에 영향을 주지 않는다.',
        ].map((label, i) => (
          <button
            type="button"
            key={label}
            aria-pressed={answer === i}
            onClick={() => setAnswer(i)}
          >
            {label}
          </button>
        ))}
      </div>
      {answer !== null && (
        <p role="status" className="story-feedback">
          {replies[answer]}
        </p>
      )}
      <noscript>
        <p>
          확인: T1이 완료할 수 있으므로 T2의 대기는 그 자체로 교착이 아닙니다.
        </p>
      </noscript>
    </section>
  )
}

export function ConcurrencyStory() {
  return (
    <article
      className="concept-story"
      aria-label="교착상태를 그림으로 이해하기"
    >
      <section className="story-opening">
        <p className="story-kicker">01 / 교착상태의 원인</p>
        <h2>
          교착상태와 순환 대기
        </h2>
        <p>
          두 작업이 데이터 A와 B를 모두 바꿔야 합니다.{' '}
          <b className="story-t1">T1은 A부터</b>,{' '}
          <b className="story-t2">T2는 B부터</b> 잠갔습니다. 이제 나머지 하나를
          얻으려는데 이미 상대가 잡고 있습니다.
        </p>
        <DeadlockLab />
        <p>
          문제는 단순히 오래 기다린다는 데 있지 않습니다.{' '}
          <strong>
            상대를 기다리는 관계가 한 바퀴 돌아 자신에게 돌아온다는 것
          </strong>
          이 핵심입니다. 위에서 잠금 순서를 바꿔 대기의 모양을 비교해 보세요.
        </p>
        <details className="story-margin-note">
          <summary>여기서 ‘잠금’과 ‘트랜잭션’은?</summary>
          <p>
            잠금은 다른 작업과 충돌하는 데이터 접근을 조정하는 장치입니다.
            트랜잭션은 함께 성공하거나 함께 취소해야 할 작업의 단위입니다. 이
            예에서는 T1·T2를 각각 하나의 트랜잭션으로 봅니다.
          </p>
        </details>
      </section>
      <section className="story-chapter">
        <p className="story-kicker">02 / 잠금 순서 통일</p>
        <h2>
          잠금 순서 통일과 순환 대기 예방
        </h2>
        <p>
          둘 다 <strong>A → B 순서</strong>로 잡게 해보겠습니다. T1이 A를 먼저
          얻었다면 T2는 A 앞에서 기다립니다. T2가 B를 선점하지 않았으니 T1은 B를
          얻어 일을 끝낼 수 있습니다.
        </p>
        <ol
          className="story-timeline"
          aria-label="같은 순서로 잠글 때의 실행 예"
        >
          <li>
            <span>1</span>
            <div>
              <strong>T1이 A → B를 획득</strong>
              <p>T2는 A를 기다림 · 보유 자원 없음</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>T1이 완료하고 A·B를 해제</strong>
              <p>T1을 가로막는 T2의 잠금이 없음</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>T2가 A → B를 얻어 실행</strong>
              <p>대기는 있었지만 두 작업 모두 완료 가능</p>
            </div>
          </li>
        </ol>
        <p className="story-takeaway">
          기억할 차이{' '}
          <strong>대기는 줄 서기. 이 교착은 서로 출구를 막기.</strong>
        </p>
        <p>
          이 비유는 위의 배타적 자원 두 개에 한정해 생각하세요. 실제
          시스템에서는 다른 자원, 잠금 모드 변경, 다른 코드 경로도 있습니다. 공통
          순서를 정했다면 <strong>관련된 모든 경로가 지키는지</strong> 확인해야
          합니다.
        </p>
        <ConcurrencyCheck />
      </section>
      <section className="story-chapter">
        <p className="story-kicker">03 / 교착 탐지와 회복</p>
        <h2>
          교착상태 탐지·트랜잭션 중단·재시도
        </h2>
        <p>
          이미 만들어진 순환은 한쪽 작업의 취소 등으로 끊어야 합니다. 예를 들어
          PostgreSQL은 교착을 탐지하면 관련 트랜잭션 중 하나를 중단해 다른
          작업이 진행하도록 합니다. 어느 작업이 중단될지는 가정하지 않습니다.
        </p>
        <div className="story-recovery" aria-label="회복의 흐름">
          <span>순환 탐지</span>
          <i aria-hidden="true">→</i>
          <span>한쪽 중단</span>
          <i aria-hidden="true">→</i>
          <span>다른 쪽 진행</span>
        </div>
        <p>
          애플리케이션에서는 취소된{' '}
          <strong>트랜잭션 전체를 적절히 재시도</strong>하는 처리가 필요합니다.
          재시도 횟수·간격을 제한하고 외부 결제나 알림처럼 이미 발생한 부수
          효과를 중복 실행하지 않도록 별도로 설계해야 합니다.
        </p>
        <aside className="story-margin-note">
          <strong>타임아웃 ≠ 교착의 증거</strong>
          <p>
            느린 작업 하나 때문에 오래 기다릴 수도 있습니다. 시간 초과만 보고
            교착이라고 단정하지 말고 실제 잠금 보유자와 대기 관계를 확인하세요.
          </p>
        </aside>
        <p className="story-to-practice">
          이제 아래 문제에 <strong>대기 그림 → 원인 → 예방 → 회복</strong>{' '}
          순서로 답해 보세요.
        </p>
      </section>
    </article>
  )
}
