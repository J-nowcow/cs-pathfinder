/** Authored procedures stay fully visible without controls or client state. */
export function ConceptSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="pmp-steps" role="list">
      {steps.map((step, i) => (
        <li key={i}>
          <span aria-hidden="true">{i + 1}</span>
          <div>{step}</div>
        </li>
      ))}
    </ol>
  )
}
