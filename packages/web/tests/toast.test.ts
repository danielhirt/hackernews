import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// The toast module uses Svelte 5 runes ($state) which can't run in jsdom.
// Following the project convention (see summaries.test.ts), we reimplement
// the core logic here to test the state machine and timer behavior.
// ---------------------------------------------------------------------------

type ToastStatus = 'loading' | 'success' | 'error'

interface Toast {
  id: string
  message: string
  status: ToastStatus
}

function createToastStore() {
  let current: Toast | null = null
  let dismissTimer: ReturnType<typeof setTimeout> | undefined

  return {
    getToast() {
      return { get value() { return current } }
    },

    showToast(message: string, status: ToastStatus = 'loading'): string {
      clearTimeout(dismissTimer)
      const id = crypto.randomUUID()
      current = { id, message, status }
      if (status === 'success') {
        dismissTimer = setTimeout(() => { current = null }, 3000)
      }
      return id
    },

    updateToast(id: string, message: string, status?: ToastStatus): void {
      if (current?.id !== id) return
      clearTimeout(dismissTimer)
      current = { id, message, status: status ?? current.status }
      if (current.status === 'success') {
        dismissTimer = setTimeout(() => { current = null }, 3000)
      }
    },

    dismissToast(): void {
      clearTimeout(dismissTimer)
      current = null
    },
  }
}

describe('toast state management', () => {
  let store: ReturnType<typeof createToastStore>

  beforeEach(() => {
    vi.useFakeTimers()
    store = createToastStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('showToast', () => {
    it('creates toast with correct id, message, and status', () => {
      const id = store.showToast('Loading...', 'loading')
      const toast = store.getToast().value

      expect(id).toBeTypeOf('string')
      expect(id.length).toBeGreaterThan(0)
      expect(toast).toEqual({ id, message: 'Loading...', status: 'loading' })
    })

    it('defaults status to loading when omitted', () => {
      store.showToast('Processing')
      expect(store.getToast().value?.status).toBe('loading')
    })

    it('replaces any existing toast (only one at a time)', () => {
      const id1 = store.showToast('First')
      const id2 = store.showToast('Second')

      expect(id1).not.toBe(id2)
      expect(store.getToast().value?.message).toBe('Second')
      expect(store.getToast().value?.id).toBe(id2)
    })

    it('auto-dismisses after 3s when status is success', () => {
      store.showToast('Done!', 'success')
      expect(store.getToast().value).not.toBeNull()

      vi.advanceTimersByTime(2999)
      expect(store.getToast().value).not.toBeNull()

      vi.advanceTimersByTime(1)
      expect(store.getToast().value).toBeNull()
    })

    it('does not auto-dismiss when status is loading', () => {
      store.showToast('Working...', 'loading')
      vi.advanceTimersByTime(10000)
      expect(store.getToast().value).not.toBeNull()
    })

    it('does not auto-dismiss when status is error', () => {
      store.showToast('Failed', 'error')
      vi.advanceTimersByTime(10000)
      expect(store.getToast().value).not.toBeNull()
    })

    it('cancels previous auto-dismiss timer when replacing toast', () => {
      store.showToast('First success', 'success')
      // Replace before the 3s timer fires
      vi.advanceTimersByTime(1000)
      store.showToast('Loading next', 'loading')

      // Original 3s timer would have fired at this point
      vi.advanceTimersByTime(3000)
      // But the new toast should still be present
      expect(store.getToast().value?.message).toBe('Loading next')
    })
  })

  describe('updateToast', () => {
    it('updates message and status for matching id', () => {
      const id = store.showToast('Saving...', 'loading')
      store.updateToast(id, 'Saved!', 'success')

      const toast = store.getToast().value
      expect(toast?.message).toBe('Saved!')
      expect(toast?.status).toBe('success')
      expect(toast?.id).toBe(id)
    })

    it('ignores update when id does not match', () => {
      store.showToast('Original', 'loading')
      store.updateToast('wrong-id', 'Should not appear', 'error')

      expect(store.getToast().value?.message).toBe('Original')
      expect(store.getToast().value?.status).toBe('loading')
    })

    it('keeps current status when status param is omitted', () => {
      const id = store.showToast('Step 1', 'loading')
      store.updateToast(id, 'Step 2')

      expect(store.getToast().value?.message).toBe('Step 2')
      expect(store.getToast().value?.status).toBe('loading')
    })

    it('triggers auto-dismiss timer when updated to success', () => {
      const id = store.showToast('Working...', 'loading')
      store.updateToast(id, 'Done!', 'success')

      vi.advanceTimersByTime(2999)
      expect(store.getToast().value).not.toBeNull()

      vi.advanceTimersByTime(1)
      expect(store.getToast().value).toBeNull()
    })

    it('does not trigger auto-dismiss when updated to error', () => {
      const id = store.showToast('Working...', 'loading')
      store.updateToast(id, 'Failed!', 'error')

      vi.advanceTimersByTime(10000)
      expect(store.getToast().value).not.toBeNull()
    })

    it('cancels previous auto-dismiss when updating from success to loading', () => {
      const id = store.showToast('Done!', 'success')
      // Update to loading before the 3s timer fires
      vi.advanceTimersByTime(1000)
      store.updateToast(id, 'Retrying...', 'loading')

      vi.advanceTimersByTime(5000)
      expect(store.getToast().value?.message).toBe('Retrying...')
    })
  })

  describe('dismissToast', () => {
    it('clears the current toast', () => {
      store.showToast('Some message')
      store.dismissToast()
      expect(store.getToast().value).toBeNull()
    })

    it('cancels any pending auto-dismiss timer', () => {
      store.showToast('Success!', 'success')
      store.dismissToast()
      // Advance past the would-be auto-dismiss timer — should not throw
      vi.advanceTimersByTime(5000)
      expect(store.getToast().value).toBeNull()
    })

    it('is safe to call when no toast is active', () => {
      expect(() => store.dismissToast()).not.toThrow()
      expect(store.getToast().value).toBeNull()
    })
  })

  describe('getToast', () => {
    it('returns reactive accessor with .value', () => {
      const accessor = store.getToast()
      expect(accessor).toHaveProperty('value')
      expect(accessor.value).toBeNull()
    })

    it('reflects current state through .value', () => {
      const accessor = store.getToast()
      expect(accessor.value).toBeNull()

      store.showToast('Hello')
      expect(accessor.value?.message).toBe('Hello')

      store.dismissToast()
      expect(accessor.value).toBeNull()
    })
  })
})
