/** Smooth-scroll to a question card (pair with CSS scroll-margin on `.tests-question--in-stack`). */
export function scrollToQuestionCard(el: HTMLElement | null | undefined) {
  if (!el) return
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
  })
}
