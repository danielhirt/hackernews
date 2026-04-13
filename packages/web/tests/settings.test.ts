import { describe, it, expect, beforeEach } from 'vitest'

const STORAGE_KEY = 'omnifeed-settings'

interface Settings {
  model: string
}

const DEFAULT_SETTINGS: Settings = {
  model: 'sonnet',
}

// Minimal reimplementation of settings logic for testing
function createSettingsStore(storage: Record<string, string>) {
  function load(): Settings {
    const raw = storage[STORAGE_KEY]
    if (!raw) return { ...DEFAULT_SETTINGS }
    try {
      const parsed = JSON.parse(raw) as Partial<Settings>
      return { ...DEFAULT_SETTINGS, ...parsed }
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  return {
    getSettings(): Settings {
      return load()
    },
    updateSettings(partial: Partial<Settings>): void {
      const current = load()
      const updated = { ...current, ...partial }
      storage[STORAGE_KEY] = JSON.stringify(updated)
    },
  }
}

describe('settings persistence', () => {
  let storage: Record<string, string>
  let store: ReturnType<typeof createSettingsStore>

  beforeEach(() => {
    storage = {}
    store = createSettingsStore(storage)
  })

  it('returns default settings when nothing stored', () => {
    expect(store.getSettings()).toEqual({ model: 'sonnet' })
  })

  it('updates and persists model setting', () => {
    store.updateSettings({ model: 'opus' })
    expect(store.getSettings().model).toBe('opus')
  })

  it('persists to storage as JSON', () => {
    store.updateSettings({ model: 'haiku' })
    const raw = JSON.parse(storage[STORAGE_KEY]) as Settings
    expect(raw.model).toBe('haiku')
  })

  it('preserves existing settings when updating partially', () => {
    store.updateSettings({ model: 'opus' })
    // Simulate adding a future setting key
    const current = JSON.parse(storage[STORAGE_KEY])
    current.futureKey = 'test'
    storage[STORAGE_KEY] = JSON.stringify(current)

    store.updateSettings({ model: 'haiku' })
    const updated = JSON.parse(storage[STORAGE_KEY])
    expect(updated.model).toBe('haiku')
    expect(updated.futureKey).toBe('test')
  })

  it('falls back to defaults on corrupt storage', () => {
    storage[STORAGE_KEY] = 'not json'
    expect(store.getSettings()).toEqual({ model: 'sonnet' })
  })

  it('falls back to defaults for missing fields', () => {
    storage[STORAGE_KEY] = JSON.stringify({})
    expect(store.getSettings().model).toBe('sonnet')
  })

  it('handles all model options', () => {
    for (const model of ['haiku', 'sonnet', 'opus']) {
      store.updateSettings({ model })
      expect(store.getSettings().model).toBe(model)
    }
  })
})
