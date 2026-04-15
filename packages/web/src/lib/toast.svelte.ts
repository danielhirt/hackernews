export type ToastStatus = 'loading' | 'success' | 'error'

export interface Toast {
  id: string
  message: string
  status: ToastStatus
}

let current = $state<Toast | null>(null)
let dismissTimer: ReturnType<typeof setTimeout> | undefined

export function getToast() {
  return {
    get value() { return current },
  }
}

export function showToast(message: string, status: ToastStatus = 'loading'): string {
  clearTimeout(dismissTimer)
  const id = crypto.randomUUID()
  current = { id, message, status }
  if (status === 'success') {
    dismissTimer = setTimeout(() => { current = null }, 3000)
  }
  return id
}

// Omit status to update only the message (e.g. progress text while staying in 'loading')
export function updateToast(id: string, message: string, status?: ToastStatus): void {
  if (current?.id !== id) return
  clearTimeout(dismissTimer)
  current = { id, message, status: status ?? current.status }
  if (current.status === 'success') {
    dismissTimer = setTimeout(() => { current = null }, 3000)
  }
}

export function dismissToast(): void {
  clearTimeout(dismissTimer)
  current = null
}
