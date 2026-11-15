export function LearningPath({ current }: { current: number }) {
  return <ol className="sp-learning-path" aria-label="학습 흐름">{['연결', '풀', '트랜잭션', '락(잠금)', '대기'].map((label, index) => <li key={label} aria-current={current === index ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
}
