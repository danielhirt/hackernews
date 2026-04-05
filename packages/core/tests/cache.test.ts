import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TtlCache } from '../src/cache.js'

describe('TtlCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns undefined for missing keys', () => {
    const cache = new TtlCache<string>(60_000)
    expect(cache.get('missing')).toBeUndefined()
  })

  it('stores and retrieves a value', () => {
    const cache = new TtlCache<string>(60_000)
    cache.set('key', 'value')
    expect(cache.get('key')).toBe('value')
  })

  it('expires entries after TTL', () => {
    const cache = new TtlCache<string>(60_000)
    cache.set('key', 'value')
    vi.advanceTimersByTime(60_001)
    expect(cache.get('key')).toBeUndefined()
  })

  it('returns value before TTL expires', () => {
    const cache = new TtlCache<string>(60_000)
    cache.set('key', 'value')
    vi.advanceTimersByTime(59_999)
    expect(cache.get('key')).toBe('value')
  })

  it('clears all entries', () => {
    const cache = new TtlCache<string>(60_000)
    cache.set('a', '1')
    cache.set('b', '2')
    cache.clear()
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBeUndefined()
  })

  it('overwrites existing entries with fresh TTL', () => {
    const cache = new TtlCache<string>(60_000)
    cache.set('key', 'old')
    vi.advanceTimersByTime(50_000)
    cache.set('key', 'new')
    vi.advanceTimersByTime(50_000)
    expect(cache.get('key')).toBe('new')
  })
})
