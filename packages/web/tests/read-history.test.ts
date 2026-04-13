import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('$app/environment', () => ({
  browser: true,
}))

// Mock localStorage
const store = new Map<string, string>()
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// Must import after mocks are in place
import { isRead, markRead } from '../src/lib/read-history.svelte'

describe('read-history', () => {
  beforeEach(() => {
    store.clear()
    // Force re-initialization by clearing module state
    // The module uses a `loaded` flag, so we need to reset it
    // Since we can't access private state, we test from a fresh module perspective
  })

  it('returns false for unread items', () => {
    expect(isRead('hn:999999')).toBe(false)
  })

  it('returns true after marking an item as read', () => {
    markRead('hn:test1')
    expect(isRead('hn:test1')).toBe(true)
  })

  it('persists reads to localStorage', () => {
    markRead('hn:persist1')
    const stored = JSON.parse(store.get('omnifeed-read') ?? '[]')
    expect(stored).toContain('hn:persist1')
  })

  it('handles multiple reads', () => {
    markRead('hn:a')
    markRead('lo:b')
    markRead('dev:c')
    expect(isRead('hn:a')).toBe(true)
    expect(isRead('lo:b')).toBe(true)
    expect(isRead('dev:c')).toBe(true)
    expect(isRead('hn:d')).toBe(false)
  })

  it('does not duplicate on re-mark', () => {
    markRead('hn:dup1')
    markRead('hn:dup1')
    const stored = JSON.parse(store.get('omnifeed-read') ?? '[]')
    const count = stored.filter((id: string) => id === 'hn:dup1').length
    expect(count).toBe(1)
  })
})

describe('feed filter logic', () => {
  // Test the filtering pattern used in +page.svelte
  // filteredItems = feedFilter === 'unread' ? items.filter(item => !isRead(item.id)) : items

  interface MockItem { id: string; title: string }

  function applyFilter(items: MockItem[], filter: 'all' | 'unread'): MockItem[] {
    return filter === 'unread'
      ? items.filter(item => !isRead(item.id))
      : items
  }

  const items: MockItem[] = [
    { id: 'hn:1', title: 'First' },
    { id: 'hn:2', title: 'Second' },
    { id: 'hn:3', title: 'Third' },
    { id: 'hn:4', title: 'Fourth' },
  ]

  it('all filter returns all items', () => {
    expect(applyFilter(items, 'all')).toHaveLength(4)
  })

  it('unread filter excludes read items', () => {
    markRead('hn:1')
    markRead('hn:3')
    const result = applyFilter(items, 'unread')
    expect(result.map(i => i.id)).toEqual(['hn:2', 'hn:4'])
  })

  it('unread filter returns all items when none are read', () => {
    const fresh = [
      { id: 'lo:fresh1', title: 'A' },
      { id: 'lo:fresh2', title: 'B' },
    ]
    expect(applyFilter(fresh, 'unread')).toHaveLength(2)
  })

  it('unread filter returns empty when all items are read', () => {
    const allRead = [
      { id: 'dev:r1', title: 'X' },
      { id: 'dev:r2', title: 'Y' },
    ]
    markRead('dev:r1')
    markRead('dev:r2')
    expect(applyFilter(allRead, 'unread')).toHaveLength(0)
  })

  it('preserves item order', () => {
    markRead('hn:order2')
    const ordered = [
      { id: 'hn:order1', title: 'A' },
      { id: 'hn:order2', title: 'B' },
      { id: 'hn:order3', title: 'C' },
    ]
    const result = applyFilter(ordered, 'unread')
    expect(result.map(i => i.id)).toEqual(['hn:order1', 'hn:order3'])
  })

  it('works across sources', () => {
    markRead('hn:cross1')
    markRead('dev:cross3')
    const mixed = [
      { id: 'hn:cross1', title: 'HN read' },
      { id: 'lo:cross2', title: 'LO unread' },
      { id: 'dev:cross3', title: 'DEV read' },
    ]
    const result = applyFilter(mixed, 'unread')
    expect(result.map(i => i.id)).toEqual(['lo:cross2'])
  })
})
