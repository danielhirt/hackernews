import { describe, it, expect, beforeEach, vi } from 'vitest'

// Test the summary persistence logic directly with localStorage mock
const STORAGE_KEY = 'omnifeed-summaries'
const EXPANDED_KEY = 'omnifeed-summaries-expanded'
const TEXT_OPEN_KEY = 'omnifeed-text-open'
const MAX_ENTRIES = 100

// Minimal reimplementation of the persistence logic for testing
function createSummaryStore(storage: Record<string, string>) {
  function load(): Map<number, string> {
    const raw = storage[STORAGE_KEY]
    if (!raw) return new Map()
    try {
      return new Map(JSON.parse(raw) as [number, string][])
    } catch {
      return new Map()
    }
  }

  function loadExpanded(): Map<number, boolean> {
    const raw = storage[EXPANDED_KEY]
    if (!raw) return new Map()
    try {
      return new Map(JSON.parse(raw) as [number, boolean][])
    } catch {
      return new Map()
    }
  }

  function save(entries: Map<number, string>) {
    const arr = [...entries.entries()].slice(-MAX_ENTRIES)
    storage[STORAGE_KEY] = JSON.stringify(arr)
    const validIds = new Set(arr.map(([id]) => id))
    const expArr = [...loadExpanded().entries()].filter(([id]) => validIds.has(id))
    storage[EXPANDED_KEY] = JSON.stringify(expArr)
  }

  return {
    getSummary(id: number): string | undefined {
      return load().get(id)
    },
    saveSummary(id: number, text: string): void {
      const entries = load()
      entries.delete(id)
      entries.set(id, text)
      save(entries)
    },
    clearSummary(id: number): void {
      const entries = load()
      entries.delete(id)
      save(entries)
    },
    isExpanded(id: number): boolean {
      return loadExpanded().get(id) ?? false
    },
    setExpanded(id: number, expanded: boolean): void {
      const exp = loadExpanded()
      exp.set(id, expanded)
      storage[EXPANDED_KEY] = JSON.stringify([...exp.entries()])
    },
    getEntryCount(): number {
      return load().size
    },
    isTextOpen(id: string): boolean {
      const raw = storage[TEXT_OPEN_KEY]
      if (!raw) return false
      try {
        const map = new Map(JSON.parse(raw) as [string, boolean][])
        return map.get(id) ?? false
      } catch {
        return false
      }
    },
    setTextOpen(id: string, open: boolean): void {
      let map: Map<string, boolean>
      try {
        map = new Map(JSON.parse(storage[TEXT_OPEN_KEY] || '[]') as [string, boolean][])
      } catch {
        map = new Map()
      }
      if (open) {
        map.set(id, true)
      } else {
        map.delete(id)
      }
      const arr = [...map.entries()].slice(-MAX_ENTRIES)
      storage[TEXT_OPEN_KEY] = JSON.stringify(arr)
    },
  }
}

describe('summaries persistence', () => {
  let storage: Record<string, string>
  let store: ReturnType<typeof createSummaryStore>

  beforeEach(() => {
    storage = {}
    store = createSummaryStore(storage)
  })

  it('returns undefined for missing summary', () => {
    expect(store.getSummary(1)).toBeUndefined()
  })

  it('saves and retrieves a summary', () => {
    store.saveSummary(1, 'Test summary')
    expect(store.getSummary(1)).toBe('Test summary')
  })

  it('overwrites existing summary', () => {
    store.saveSummary(1, 'Old')
    store.saveSummary(1, 'New')
    expect(store.getSummary(1)).toBe('New')
  })

  it('clears a summary', () => {
    store.saveSummary(1, 'Test')
    store.clearSummary(1)
    expect(store.getSummary(1)).toBeUndefined()
  })

  it('stores multiple summaries independently', () => {
    store.saveSummary(1, 'First')
    store.saveSummary(2, 'Second')
    expect(store.getSummary(1)).toBe('First')
    expect(store.getSummary(2)).toBe('Second')
  })

  it('persists to storage as JSON', () => {
    store.saveSummary(42, 'Hello')
    const raw = JSON.parse(storage[STORAGE_KEY]) as [number, string][]
    expect(raw).toEqual([[42, 'Hello']])
  })

  it('evicts oldest entries when exceeding max', () => {
    for (let i = 1; i <= MAX_ENTRIES + 10; i++) {
      store.saveSummary(i, `Summary ${i}`)
    }
    expect(store.getEntryCount()).toBe(MAX_ENTRIES)
    // First 10 should be evicted
    expect(store.getSummary(1)).toBeUndefined()
    expect(store.getSummary(10)).toBeUndefined()
    // Remaining should exist
    expect(store.getSummary(11)).toBe('Summary 11')
    expect(store.getSummary(MAX_ENTRIES + 10)).toBe(`Summary ${MAX_ENTRIES + 10}`)
  })

  it('moves re-saved entry to end (LRU)', () => {
    store.saveSummary(1, 'A')
    store.saveSummary(2, 'B')
    store.saveSummary(3, 'C')
    // Re-save entry 1 to move it to the end
    store.saveSummary(1, 'A updated')

    const raw = JSON.parse(storage[STORAGE_KEY]) as [number, string][]
    const ids = raw.map(([id]) => id)
    expect(ids).toEqual([2, 3, 1])
    expect(store.getSummary(1)).toBe('A updated')
  })

  it('handles empty storage gracefully', () => {
    storage[STORAGE_KEY] = ''
    expect(store.getSummary(1)).toBeUndefined()
  })

  it('handles corrupt storage gracefully', () => {
    storage[STORAGE_KEY] = '{not valid json'
    expect(() => store.getSummary(1)).not.toThrow()
  })
})

describe('expanded state persistence', () => {
  let storage: Record<string, string>
  let store: ReturnType<typeof createSummaryStore>

  beforeEach(() => {
    storage = {}
    store = createSummaryStore(storage)
  })

  it('defaults to collapsed (false) for unknown IDs', () => {
    expect(store.isExpanded(1)).toBe(false)
  })

  it('persists expanded state', () => {
    store.setExpanded(1, true)
    expect(store.isExpanded(1)).toBe(true)
  })

  it('persists collapsed state', () => {
    store.setExpanded(1, true)
    store.setExpanded(1, false)
    expect(store.isExpanded(1)).toBe(false)
  })

  it('tracks expanded state independently per ID', () => {
    store.setExpanded(1, true)
    store.setExpanded(2, false)
    expect(store.isExpanded(1)).toBe(true)
    expect(store.isExpanded(2)).toBe(false)
  })

  it('cleans up expanded state when summary is evicted', () => {
    store.setExpanded(1, true)
    store.saveSummary(1, 'Test')
    // Evict entry 1 by filling past MAX_ENTRIES
    for (let i = 2; i <= MAX_ENTRIES + 1; i++) {
      store.saveSummary(i, `Summary ${i}`)
    }
    // Entry 1 evicted, expanded state should be cleaned
    const expRaw = storage[EXPANDED_KEY]
    const expEntries = JSON.parse(expRaw) as [number, boolean][]
    expect(expEntries.find(([id]) => id === 1)).toBeUndefined()
  })

  it('cleans up expanded state when summary is cleared', () => {
    store.saveSummary(1, 'Test')
    store.setExpanded(1, true)
    store.clearSummary(1)
    // After clearing, expanded state for that ID should be removed from storage
    const expRaw = storage[EXPANDED_KEY]
    if (expRaw) {
      const expEntries = JSON.parse(expRaw) as [number, boolean][]
      expect(expEntries.find(([id]) => id === 1)).toBeUndefined()
    }
  })
})

describe('textOpen state persistence', () => {
  let storage: Record<string, string>
  let store: ReturnType<typeof createSummaryStore>

  beforeEach(() => {
    storage = {}
    store = createSummaryStore(storage)
  })

  it('defaults to closed (false) for unknown IDs', () => {
    expect(store.isTextOpen('hn:1')).toBe(false)
  })

  it('persists text-open state', () => {
    store.setTextOpen('hn:1', true)
    expect(store.isTextOpen('hn:1')).toBe(true)
  })

  it('removes entry when closed', () => {
    store.setTextOpen('hn:1', true)
    store.setTextOpen('hn:1', false)
    expect(store.isTextOpen('hn:1')).toBe(false)
    const raw = JSON.parse(storage[TEXT_OPEN_KEY]) as [string, boolean][]
    expect(raw.find(([id]) => id === 'hn:1')).toBeUndefined()
  })

  it('tracks text-open state independently per ID', () => {
    store.setTextOpen('hn:1', true)
    store.setTextOpen('hn:2', false)
    store.setTextOpen('lo:abc', true)
    expect(store.isTextOpen('hn:1')).toBe(true)
    expect(store.isTextOpen('hn:2')).toBe(false)
    expect(store.isTextOpen('lo:abc')).toBe(true)
  })

  it('survives reload from storage', () => {
    store.setTextOpen('hn:42', true)
    // Create a new store instance reading from same storage (simulates reload)
    const store2 = createSummaryStore(storage)
    expect(store2.isTextOpen('hn:42')).toBe(true)
  })
})
