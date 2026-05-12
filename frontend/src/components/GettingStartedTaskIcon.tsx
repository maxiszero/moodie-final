/** Checklist icons for “first steps” — SVG instead of emoji for consistent rendering. */

export function GettingStartedTaskIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg
        className="gs-task-icon gs-task-icon--done"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" className="gs-task-icon__fill" fill="currentColor" />
        <path
          d="M8 12.2l2.2 2.2L16 8.6"
          stroke="var(--gs-check-mark, #fff)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg className="gs-task-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.65" className="gs-task-icon__ring" />
    </svg>
  )
}
