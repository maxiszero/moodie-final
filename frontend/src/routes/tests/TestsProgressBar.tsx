type Props = { completed: number; total: number }

export function TestsProgressBar({ completed, total }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  return (
    <div
      className="tests-progress"
      role="progressbar"
      aria-valuenow={completed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${completed} / ${total}`}
    >
      <div className="tests-progress__bar">
        <div className="tests-progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
