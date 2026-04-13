import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FeedItem, ContentSource } from '@omnifeed/core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a deterministic feed item (timestamp fixed to avoid fake-timer drift). */
function makeFeedItem(
  id: string,
  source: ContentSource = 'hackernews',
): FeedItem {
  return {
    id,
    source,
    title: `Item ${id}`,
    score: 10,
    author: 'test',
    timestamp: 1700000000, // fixed — no Date.now() dependency
    commentCount: 0,
    sourceUrl: `https://example.com/${id}`,
  }
}

// ---------------------------------------------------------------------------
// Mock factories — shared mock fns reset between tests
// ---------------------------------------------------------------------------

const mockFetchFeed = vi.fn<(feedId: string, page: number) => Promise<FeedItem[]>>()
const mockFetchTag = vi.fn<(tag: string, page: number) => Promise<FeedItem[]>>()
const mockClearCache = vi.fn()

const mockClient = {
  fetchFeed: mockFetchFeed,
  fetchTag: mockFetchTag,
  clearCache: mockClearCache,
}

vi.mock('@omnifeed/core', async () => {
  const actual = await vi.importActual<typeof import('@omnifeed/core')>('@omnifeed/core')
  return {
    ...actual,
    createSourceClient: () => mockClient,
    LobstersClient: class {
      fetchFeed = mockFetchFeed
      fetchTag = mockFetchTag
      clearCache = mockClearCache
    },
  }
})

// ---------------------------------------------------------------------------
// Module-under-test loaded dynamically for each test (fresh module state)
// ---------------------------------------------------------------------------

type FeedModule = typeof import('../src/lib/feed.svelte')

async function importFeedModule(): Promise<FeedModule> {
  return import('../src/lib/feed.svelte')
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  vi.restoreAllMocks()
  // Reset the mock functions explicitly to clear queued implementations
  mockFetchFeed.mockReset()
  mockFetchTag.mockReset()
  mockClearCache.mockReset()
  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// 1. Fresh cache behavior (characterization)
// ---------------------------------------------------------------------------

describe('fresh cache behavior', () => {
  it('serves from cache on navigation within TTL', async () => {
    const firstBatch = [makeFeedItem('hn:1'), makeFeedItem('hn:2')]

    // Mock queue: [hn items, lobsters items]
    mockFetchFeed
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce([makeFeedItem('lo:1', 'lobsters')])

    const { loadFeed, getFeedState } = await importFeedModule()

    // Initial load
    await loadFeed('hackernews', 'top')
    expect(getFeedState().items).toEqual(firstBatch)
    expect(mockFetchFeed).toHaveBeenCalledTimes(1)

    // Navigate away (load different feed)
    await loadFeed('lobsters', 'hottest')
    expect(mockFetchFeed).toHaveBeenCalledTimes(2)

    // Navigate back within TTL (< 5 min)
    vi.advanceTimersByTime(2 * 60 * 1000)
    await loadFeed('hackernews', 'top')

    // Assert: no additional fetch — items served from cache
    expect(mockFetchFeed).toHaveBeenCalledTimes(2) // still 2, no new call
    expect(getFeedState().items).toEqual(firstBatch)
    expect(getFeedState().loading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2-4. TTL expiry and stale-while-revalidate
// ---------------------------------------------------------------------------

describe('TTL expiry and stale-while-revalidate', () => {
  it('triggers background revalidation when cache is stale', async () => {
    const staleBatch = [makeFeedItem('hn:1'), makeFeedItem('hn:2')]
    const freshBatch = [makeFeedItem('hn:3'), makeFeedItem('hn:4')]
    let resolveRevalidation!: (items: FeedItem[]) => void

    // Mock queue: [initial hn, lobsters, then revalidation (pending)]
    mockFetchFeed
      .mockResolvedValueOnce(staleBatch)
      .mockResolvedValueOnce([makeFeedItem('lo:1', 'lobsters')])
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveRevalidation = resolve }),
      )

    const { loadFeed, getFeedState } = await importFeedModule()

    // Initial load
    await loadFeed('hackernews', 'top')
    expect(getFeedState().items).toEqual(staleBatch)

    // Navigate away
    await loadFeed('lobsters', 'hottest')

    // Advance past TTL (5 min)
    vi.advanceTimersByTime(6 * 60 * 1000)

    // Navigate back — should serve stale data immediately, trigger bg revalidation
    await loadFeed('hackernews', 'top')

    // Stale items served immediately
    expect(getFeedState().items).toEqual(staleBatch)
    expect(getFeedState().loading).toBe(false)

    // Background revalidation resolves
    resolveRevalidation(freshBatch)
    // Flush microtasks so the background promise settles
    await vi.advanceTimersByTimeAsync(0)

    // Items updated to fresh data
    expect(getFeedState().items).toEqual(freshBatch)
  })

  it('does not show loading spinner during background revalidation', async () => {
    const staleBatch = [makeFeedItem('hn:1')]
    let resolveRevalidation!: (items: FeedItem[]) => void

    mockFetchFeed
      .mockResolvedValueOnce(staleBatch)
      .mockResolvedValueOnce([makeFeedItem('lo:1', 'lobsters')])
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveRevalidation = resolve }),
      )

    const { loadFeed, getFeedState } = await importFeedModule()

    // Initial load
    await loadFeed('hackernews', 'top')
    expect(getFeedState().loading).toBe(false)

    // Navigate away
    await loadFeed('lobsters', 'hottest')

    // Advance past TTL
    vi.advanceTimersByTime(6 * 60 * 1000)

    // Navigate back — stale-while-revalidate
    await loadFeed('hackernews', 'top')

    // Loading should NOT be true during background revalidation
    expect(getFeedState().loading).toBe(false)
    expect(getFeedState().items).toEqual(staleBatch)

    // Resolve the revalidation
    resolveRevalidation([makeFeedItem('hn:fresh')])
    await vi.advanceTimersByTimeAsync(0)

    expect(getFeedState().loading).toBe(false)
  })

  it('keeps stale data if background revalidation fails', async () => {
    const staleBatch = [makeFeedItem('hn:1'), makeFeedItem('hn:2')]

    // Mock queue: [initial hn, lobsters, failing revalidation]
    mockFetchFeed
      .mockResolvedValueOnce(staleBatch)
      .mockResolvedValueOnce([makeFeedItem('lo:1', 'lobsters')])
      .mockRejectedValueOnce(new Error('Network error'))

    const { loadFeed, getFeedState } = await importFeedModule()

    // Initial load
    await loadFeed('hackernews', 'top')

    // Navigate away
    await loadFeed('lobsters', 'hottest')

    // Advance past TTL
    vi.advanceTimersByTime(6 * 60 * 1000)

    // Navigate back — background revalidation will fail
    await loadFeed('hackernews', 'top')
    // Flush microtasks for the background revalidation rejection
    await vi.advanceTimersByTimeAsync(0)

    // Stale items should still be present (not cleared)
    expect(getFeedState().items).toEqual(staleBatch)
    expect(getFeedState().loading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 5-6. Refresh eviction
// ---------------------------------------------------------------------------

describe('refresh eviction', () => {
  it('explicit refresh always evicts cache regardless of TTL', async () => {
    const initialBatch = [makeFeedItem('hn:1')]
    const refreshedBatch = [makeFeedItem('hn:fresh')]

    mockFetchFeed
      .mockResolvedValueOnce(initialBatch)
      .mockResolvedValueOnce(refreshedBatch)

    const { loadFeed, refreshFeed, getFeedState } = await importFeedModule()

    // Initial load
    await loadFeed('hackernews', 'top')
    expect(getFeedState().items).toEqual(initialBatch)
    expect(mockFetchFeed).toHaveBeenCalledTimes(1)

    // Advance only 1 minute (well within TTL)
    vi.advanceTimersByTime(1 * 60 * 1000)

    // Explicit refresh should bypass cache and re-fetch
    await refreshFeed()
    expect(mockFetchFeed).toHaveBeenCalledTimes(2)
    expect(getFeedState().items).toEqual(refreshedBatch)
  })

  it('explicit refresh shows loading state', async () => {
    const initialBatch = [makeFeedItem('hn:1')]
    let resolveRefresh!: (items: FeedItem[]) => void

    mockFetchFeed
      .mockResolvedValueOnce(initialBatch)
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveRefresh = resolve }),
      )

    const { loadFeed, refreshFeed, getFeedState } = await importFeedModule()

    await loadFeed('hackernews', 'top')
    expect(getFeedState().loading).toBe(false)

    // Start refresh without awaiting — check intermediate loading state
    const refreshPromise = refreshFeed()

    // Loading should be true during an explicit refresh
    expect(getFeedState().loading).toBe(true)

    // Resolve the fetch
    const refreshedItems = [makeFeedItem('hn:refreshed')]
    resolveRefresh(refreshedItems)
    await refreshPromise

    expect(getFeedState().loading).toBe(false)
    expect(getFeedState().items).toEqual(refreshedItems)
  })
})

// ---------------------------------------------------------------------------
// 7. loadMore does not reset fetchedAt
// ---------------------------------------------------------------------------

describe('loadMore and fetchedAt', () => {
  it('loadMore does not reset fetchedAt', async () => {
    const page0 = [makeFeedItem('hn:1'), makeFeedItem('hn:2')]
    const page1 = [makeFeedItem('hn:3')]

    // Mock queue: [initial page, loadMore page, lobsters, revalidation]
    mockFetchFeed
      .mockResolvedValueOnce(page0)
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce([makeFeedItem('lo:1', 'lobsters')])
      .mockResolvedValueOnce([makeFeedItem('hn:new1')])

    const { loadFeed, loadMore, getFeedState } = await importFeedModule()

    // Initial load at t=0
    await loadFeed('hackernews', 'top')
    expect(getFeedState().items).toHaveLength(2)

    // Advance 3 minutes, then loadMore
    vi.advanceTimersByTime(3 * 60 * 1000)
    // Need to advance past the loadMoreCooldown check — no cooldown on first call
    await loadMore()
    expect(getFeedState().items).toHaveLength(3)

    // Navigate away
    await loadFeed('lobsters', 'hottest')

    // Advance 3 more minutes — total 6 min from initial fetch, past 5 min TTL
    vi.advanceTimersByTime(3 * 60 * 1000)

    // Navigate back — should trigger revalidation because fetchedAt is from
    // initial load (6 min ago), NOT from loadMore (3 min ago)
    await loadFeed('hackernews', 'top')
    // Flush microtasks for background revalidation
    await vi.advanceTimersByTimeAsync(0)

    // The revalidation should have been triggered (4th mock consumed)
    // Initial(1) + loadMore(2) + lobsters(3) + revalidation(4) = 4 calls
    expect(mockFetchFeed).toHaveBeenCalledTimes(4)
  })
})

// ---------------------------------------------------------------------------
// 8. Omnifeed stale-while-revalidate
// ---------------------------------------------------------------------------

describe('omnifeed stale-while-revalidate', () => {
  it('omnifeed serves stale then revalidates after TTL', async () => {
    const hnItems = [makeFeedItem('hn:1')]
    const loItems = [makeFeedItem('lo:1', 'lobsters')]
    const devItems = [makeFeedItem('dev:1', 'devto')]

    // Fresh data for revalidation
    const freshHn = [makeFeedItem('hn:fresh1')]
    const freshLo = [makeFeedItem('lo:fresh1', 'lobsters')]
    const freshDev = [makeFeedItem('dev:fresh1', 'devto')]

    let resolveRevalidations!: () => void
    const revalidationGate = new Promise<void>((resolve) => {
      resolveRevalidations = resolve
    })

    // Mock queue:
    // 1-3: initial omnifeed (3 sources)
    // 4: navigate to single source (hn)
    // 5-7: background revalidation for omnifeed (3 sources, gated)
    mockFetchFeed
      .mockResolvedValueOnce(hnItems)
      .mockResolvedValueOnce(loItems)
      .mockResolvedValueOnce(devItems)
      .mockResolvedValueOnce([makeFeedItem('hn:solo')])
      .mockImplementationOnce(() => revalidationGate.then(() => freshHn))
      .mockImplementationOnce(() => revalidationGate.then(() => freshLo))
      .mockImplementationOnce(() => revalidationGate.then(() => freshDev))

    const { loadOmnifeed, loadFeed, getFeedState } = await importFeedModule()

    // Initial omnifeed load
    await loadOmnifeed('newest')
    const initialItems = [...getFeedState().items] // snapshot
    expect(initialItems).toHaveLength(3)

    // Navigate away to a single source
    await loadFeed('hackernews', 'top')

    // Advance past TTL
    vi.advanceTimersByTime(6 * 60 * 1000)

    // Navigate back to omnifeed — should serve stale then revalidate
    await loadOmnifeed('newest')

    // Stale items served immediately
    expect(getFeedState().items).toEqual(initialItems)
    expect(getFeedState().loading).toBe(false)

    // Resolve background revalidation
    resolveRevalidations()
    await vi.advanceTimersByTimeAsync(0)

    // Items should now be the fresh ones
    const updatedItems = getFeedState().items
    expect(updatedItems).toHaveLength(3)
    expect(updatedItems.some((i) => i.id === 'hn:fresh1')).toBe(true)
    expect(updatedItems.some((i) => i.id === 'lo:fresh1')).toBe(true)
    expect(updatedItems.some((i) => i.id === 'dev:fresh1')).toBe(true)
  })
})
