import { describe, it, expect } from 'vitest'
import type { FeedItem, ContentSource } from '@omnifeed/core'

function makeFeedItem(source: ContentSource, timestamp: number): FeedItem {
  return {
    id: `${source === 'hackernews' ? 'hn' : source === 'lobsters' ? 'lo' : 'dev'}:${Math.random().toString(36).slice(2, 8)}`,
    source,
    title: `Item from ${source}`,
    score: 10,
    author: 'user',
    timestamp,
    commentCount: 5,
    sourceUrl: 'https://example.com',
  }
}

type SourceFilter = 'all' | 'hackernews' | 'lobsters' | 'devto'

function filterBySource(items: FeedItem[], filter: SourceFilter): FeedItem[] {
  if (filter === 'all') return items
  return items.filter(item => item.source === filter)
}

describe('source filter', () => {
  const items: FeedItem[] = [
    makeFeedItem('hackernews', 300),
    makeFeedItem('lobsters', 200),
    makeFeedItem('devto', 100),
    makeFeedItem('hackernews', 50),
  ]

  it('returns all items when filter is "all"', () => {
    expect(filterBySource(items, 'all')).toHaveLength(4)
  })

  it('filters to hackernews only', () => {
    const result = filterBySource(items, 'hackernews')
    expect(result).toHaveLength(2)
    expect(result.every(i => i.source === 'hackernews')).toBe(true)
  })

  it('filters to lobsters only', () => {
    const result = filterBySource(items, 'lobsters')
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('lobsters')
  })

  it('filters to devto only', () => {
    const result = filterBySource(items, 'devto')
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('devto')
  })

  it('returns empty array when no items match filter', () => {
    const hnOnly = [makeFeedItem('hackernews', 100)]
    expect(filterBySource(hnOnly, 'devto')).toEqual([])
  })

  it('preserves item order', () => {
    const result = filterBySource(items, 'hackernews')
    expect(result[0].timestamp).toBe(300)
    expect(result[1].timestamp).toBe(50)
  })
})
