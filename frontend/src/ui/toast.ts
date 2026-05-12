type ToastKind = 'info' | 'error'

let current: HTMLDivElement | null = null
let hideTimer: number | null = null

function ensureToast(): HTMLDivElement {
  if (current && document.body.contains(current)) return current
  const el = document.createElement('div')
  el.className = 'toast'
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', 'polite')
  document.body.appendChild(el)
  current = el
  return el
}

function clearTimer() {
  if (hideTimer != null) {
    window.clearTimeout(hideTimer)
    hideTimer = null
  }
}

export function showToast(message: string, kind: ToastKind = 'info', ms = 2600) {
  if (typeof document === 'undefined') return
  const el = ensureToast()
  el.dataset.kind = kind
  el.textContent = message
  el.classList.add('toast--show')
  clearTimer()
  hideTimer = window.setTimeout(() => {
    el.classList.remove('toast--show')
  }, ms)
}

