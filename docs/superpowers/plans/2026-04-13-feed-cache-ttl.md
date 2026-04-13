# Feed Cache TTL & Stale-While-Revalidate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TTL-based expiry with stale-while-revalidate to the web-layer feed cache so all feeds (HN, Lobsters, DEV.to, omnifeed) get uniform caching with background revalidation on stale hits, while explicit refresh always evicts and fetches fresh.

**Architecture:** The `FeedCache` interface in `packages/web/src/lib/feed.svelte.ts` gains a `fetchedAt` timestamp. A new `isCacheStale()` helper checks `Date.now() - fetchedAt >= TTL`. On navigation, stale entries serve cached items immediately and kick off a background re-fetch of page 0. Explicit refresh always evicts fully. A new test file exercises all cache behaviors with fake timers and mock fetch functions.

**Tech Stack:** Svelte 5 runes (`$state`), Vitest (fake timers, mocks), TypeScript

**Spec:** `docs/superpowers/specs/2026-04-13-feed-cache-ttl-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/web/src/lib/feed.svelte.ts` | Modify | Add `fetchedAt` to `FeedCache`, add `FEED_CACHE_TTL` constant, add `isCacheStale()` helper, modify `loadFeed()` and `loadOmnifeed()` for stale-while-revalidate, stamp `fetchedAt` on all cache writes |
| `packages/web/tests/feed-cache.test.ts` | Create | Unit tests for TTL, stale-while-revalidate, explicit refresh eviction, revalidation failure resilience, loadMore/fetchedAt interaction |

---

### Task 1: Write failing tests for fresh cache behavior

**Files:**
- Create: `packages/web/tests/feed-cache.test.ts`

These tests verify the existing behavior that should be preserved: fresh cache hits serve from cache without re-fetching.

- [ ] **Step 1: Create the test file with fresh-cache tests**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We'll test the feed module by importing its functions and mocking the source clients.
// The feed module uses module-level state, so we need dynamic imports to reset between tests.

// Mock the @omnifeed/core module to provide controllable source clients
const mockFetchFeed = vi.fn()
const mockFetchTag = vi.fn()
const mockClearCache = vi.fn()

vi.mock('@omnifeed/core', async () => {
  const actual = await vi.importActual<typeof import('@omnifeed/core')>('@omnifeed/core')
  return {
    ...actual,
    createSourceClient: () => ({
      fetchFeed: mockFetchFeed,
      fetchTag: mockFetchTag,
      clearCache: mockClearCache,
    }),
    LobstersClient: vi.fn().mockImplementation(() => ({
      fetchFeed: mockFetchFeed,
      fetchTag: mockFetchTag,
    })),
  }
})

// Mock $app/environment
vi.mock('$app/environment', () => ({ browser: true }))

function makeFeedItem(id: string, source: 'hackernews' | 'lobsters' | 'devto' = 'hackernews') {
  return {
    id,
    source,
    title: `Item ${id}`,
    score: 10,
    author: 'test',
    timestamp: Math.floor(Date.now() / 1000),
    commentCount: 0,
    sourceUrl: `https://example.com/${id}`,
  }
}

describe('Feed cache TTL', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    mockFetchFeed.mockReset()
    mockFetchTag.mockReset()
    mockClearCache.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('serves from cache on navigation within TTL (no re-fetch)', async () => {
    const items = [makeFeedItem('hn:1'), makeFeedItem('hn:2')]
    mockFetchFeed.mockResolvedValue(items)

    const { loadFeed, getFeedState } = await import('../src/lib/feed.svelte')

    // First load — fetches from API
    await loadFeed('hackernews', 'top')
    expect(mockFetchFeed).toHaveBeenCalledTimes(1)
    expect(getFeedState().items).toHaveLength(2)

    // Advance time but stay within TTL (5 min)
    vi.advanceTimersByTime(2 * 60 * 1000)

    // Load a different feed
    mockFetchFeed.mockResolvedValue([makeFeedItem('hn:3')])
    await loadFeed('hackernews', 'new')
    expect(mockFetchFeed).toHaveBeenCalledTimes(2)

    // Navigate back — should serve from cache, NOT re-fetch
    await loadFeed('hackernews', 'top')
    expect(mockFetchFeed).toHaveBeenCalledTimes(2) // no new call
    expect(getFeedState().items).toHaveLength(2) // original items
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && pnpm vitest run tests/feed-cache.test.ts`

Expected: The test may pass (it tests existing behavior) or may fail due to module import issues. Either way, we confirm the test infrastructure works. If it passes, that's fine — this is a characterization test.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/feed-cache.test.ts
git commit -m "test: add feed cache characterization test for fresh hit behavior"
```

---

### Task 2: Write failing tests for TTL expiry and stale-while-revalidate

**Files:**
- Modify: `packages/web/tests/feed-cache.test.ts`

These tests drive the new TTL and stale-while-revalidate behavior. They will fail until we implement the feature.

- [ ] **Step 1: Add TTL and revalidation tests**

Append these tests inside the `describe('Feed cache TTL')` block:

```ts
  it('triggers background revalidation when cache is stale', async () => {
    const originalItems = [makeFeedItem('hn:1'), makeFeedItem('hn:2')]
    mockFetchFeed.mockResolvedValue(originalItems)

    const { loadFeed, getFeedState } = await import('../src/lib/feed.svelte')

    // First load
    await loadFeed('hackernews', 'top')
    expect(mockFetchFeed).toHaveBeenCalledTimes(1)

    // Navigate away
    mockFetchFeed.mockResolvedValue([makeFeedItem('hn:3')])
    await loadFeed('hackernews', 'new')

    // Advance past TTL (5 min)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)

    // Prepare fresh data for revalidation
    const freshItems = [makeFeedItem('hn:10'), makeFeedItem('hn:11'), makeFeedItem('hn:12')]
    mockFetchFeed.mockResolvedValue(freshItems)

    // Navigate back — should show stale items immediately, then revalidate
    await loadFeed('hackernews', 'top')

    // Should NOT have shown loading state (stale data served immediately)
    expect(getFeedState().loading).toBe(false)

    // Should have kicked off a re-fetch (call count goes up)
    // Wait for the background revalidation to resolve
    await vi.runAllTimersAsync()
    // One extra call for the background revalidation
    expect(mockFetchFeed).toHaveBeenCalledTimes(4) // initial + new + stale-serve-triggers-revalidate

    // Items should now be the fresh ones
    expect(getFeedState().items).toHaveLength(3)
    expect(getFeedState().items[0].id).toBe('hn:10')
  })

  it('does not show loading spinner during background revalidation', async () => {
    const items = [makeFeedItem('hn:1')]
    mockFetchFeed.mockResolvedValue(items)

    const { loadFeed, getFeedState } = await import('../src/lib/feed.svelte')

    await loadFeed('hackernews', 'top')

    // Advance past TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)

    // Make revalidation slow
    mockFetchFeed.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve([makeFeedItem('hn:2')]), 1000)
    }))

    // Navigate back
    await loadFeed('hackernews', 'top')

    // loading should be false (stale data shown immediately)
    expect(getFeedState().loading).toBe(false)

    // Items should be the stale ones (revalidation hasn't resolved yet)
    expect(getFeedState().items[0].id).toBe('hn:1')

    // Resolve the revalidation
    await vi.advanceTimersByTimeAsync(1000)

    // Now items should be fresh
    expect(getFeedState().items[0].id).toBe('hn:2')
  })

  it('keeps stale data if background revalidation fails', async () => {
    const items = [makeFeedItem('hn:1')]
    mockFetchFeed.mockResolvedValue(items)

    const { loadFeed, getFeedState } = await import('../src/lib/feed.svelte')

    await loadFeed('hackernews', 'top')

    // Advance past TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)

    // Revalidation will fail
    mockFetchFeed.mockRejectedValue(new Error('Network error'))

    // Navigate back — should serve stale data
    await loadFeed('hackernews', 'top')
    await vi.runAllTimersAsync()

    // Original stale items preserved
    expect(getFeedState().items).toHaveLength(1)
    expect(getFeedState().items[0].id).toBe('hn:1')
    expect(getFeedState().loading).toBe(false)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/web && pnpm vitest run tests/feed-cache.test.ts`

Expected: The new tests fail because `loadFeed()` currently returns early on cache hit with no TTL check — it never triggers revalidation.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/feed-cache.test.ts
git commit -m "test: add failing tests for feed cache TTL and stale-while-revalidate"
```

---

### Task 3: Write failing tests for explicit refresh and loadMore interaction

**Files:**
- Modify: `packages/web/tests/feed-cache.test.ts`

- [ ] **Step 1: Add refresh and loadMore tests**

Append inside the `describe('Feed cache TTL')` block:

```ts
  it('explicit refresh always evicts cache regardless of TTL', async () => {
    const items = [makeFeedItem('hn:1')]
    mockFetchFeed.mockResolvedValue(items)

    const { loadFeed, refreshFeed, getFeedState } = await import('../src/lib/feed.svelte')

    await loadFeed('hackernews', 'top')
    expect(mockFetchFeed).toHaveBeenCalledTimes(1)

    // Still within TTL
    vi.advanceTimersByTime(1 * 60 * 1000)

    // Refresh should fetch fresh regardless
    const freshItems = [makeFeedItem('hn:99')]
    mockFetchFeed.mockResolvedValue(freshItems)
    await refreshFeed()

    // Should have fetched again (not served from cache)
    expect(mockFetchFeed).toHaveBeenCalledTimes(2)
    expect(getFeedState().items[0].id).toBe('hn:99')
  })

  it('explicit refresh shows loading state', async () => {
    const items = [makeFeedItem('hn:1')]
    mockFetchFeed.mockResolvedValue(items)

    const { loadFeed, refreshFeed, getFeedState } = await import('../src/lib/feed.svelte')

    await loadFeed('hackernews', 'top')

    let loadingDuringRefresh = false
    mockFetchFeed.mockImplementation(() => {
      // Capture loading state during the fetch
      loadingDuringRefresh = getFeedState().loading
      return Promise.resolve([makeFeedItem('hn:2')])
    })

    await refreshFeed()
    expect(loadingDuringRefresh).toBe(true)
  })

  it('loadMore does not reset fetchedAt', async () => {
    const page0 = [makeFeedItem('hn:1'), makeFeedItem('hn:2')]
    mockFetchFeed.mockResolvedValueOnce(page0)

    const { loadFeed, loadMore, getFeedState } = await import('../src/lib/feed.svelte')

    await loadFeed('hackernews', 'top')

    // Advance 3 minutes (within TTL)
    vi.advanceTimersByTime(3 * 60 * 1000)

    // Load more
    const page1 = [makeFeedItem('hn:3'), makeFeedItem('hn:4')]
    mockFetchFeed.mockResolvedValueOnce(page1)
    await loadMore()

    expect(getFeedState().items).toHaveLength(4)

    // Advance 2 more minutes (total 5 min from original fetch)
    vi.advanceTimersByTime(2 * 60 * 1000 + 1)

    // Navigate away and back — cache should be stale since fetchedAt was NOT reset by loadMore
    mockFetchFeed.mockResolvedValueOnce([makeFeedItem('hn:5')])
    await loadFeed('hackernews', 'new')

    const revalidateItems = [makeFeedItem('hn:10')]
    mockFetchFeed.mockResolvedValue(revalidateItems)
    await loadFeed('hackernews', 'top')
    await vi.runAllTimersAsync()

    // Background revalidation should have fired (cache was stale)
    // Items should be the revalidated ones
    expect(getFeedState().items[0].id).toBe('hn:10')
  })

  it('omnifeed serves stale then revalidates after TTL', async () => {
    const hnItems = [makeFeedItem('hn:1', 'hackernews')]
    const loItems = [makeFeedItem('lo:1', 'lobsters')]
    const devItems = [makeFeedItem('dev:1', 'devto')]
    mockFetchFeed
      .mockResolvedValueOnce(hnItems)
      .mockResolvedValueOnce(loItems)
      .mockResolvedValueOnce(devItems)

    const { loadOmnifeed, getFeedState } = await import('../src/lib/feed.svelte')

    await loadOmnifeed('newest')
    expect(getFeedState().items).toHaveLength(3)

    // Advance past TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)

    // Prepare fresh data
    const freshHn = [makeFeedItem('hn:10', 'hackernews')]
    const freshLo = [makeFeedItem('lo:10', 'lobsters')]
    const freshDev = [makeFeedItem('dev:10', 'devto')]
    mockFetchFeed
      .mockResolvedValueOnce(freshHn)
      .mockResolvedValueOnce(freshLo)
      .mockResolvedValueOnce(freshDev)

    // Re-load omnifeed — should serve stale then revalidate
    await loadOmnifeed('newest')
    expect(getFeedState().loading).toBe(false) // stale data served immediately

    await vi.runAllTimersAsync()

    // Fresh items should now be showing
    const ids = getFeedState().items.map(i => i.id)
    expect(ids).toContain('hn:10')
    expect(ids).toContain('lo:10')
    expect(ids).toContain('dev:10')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/web && pnpm vitest run tests/feed-cache.test.ts`

Expected: TTL-related tests fail (no `fetchedAt` tracking, no revalidation logic). The refresh test may pass since `refreshFeed()` already evicts.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/feed-cache.test.ts
git commit -m "test: add failing tests for refresh eviction, loadMore/fetchedAt, omnifeed revalidation"
```

---

### Task 4: Implement TTL and stale-while-revalidate in feed.svelte.ts

**Files:**
- Modify: `packages/web/src/lib/feed.svelte.ts`

- [ ] **Step 1: Add fetchedAt to FeedCache and add TTL constant + helper**

In `packages/web/src/lib/feed.svelte.ts`, change the `FeedCache` interface and add the TTL constant and helper:

Find:
```ts
interface FeedCache {
  items: FeedItem[]
  currentPage: number
  exhausted: boolean
}
```

Replace with:
```ts
interface FeedCache {
  items: FeedItem[]
  currentPage: number
  exhausted: boolean
  fetchedAt: number
}

const FEED_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function isCacheStale(entry: FeedCache): boolean {
  return Date.now() - entry.fetchedAt >= FEED_CACHE_TTL
}
```

- [ ] **Step 2: Add revalidateFeed helper for background re-fetch of single-source feeds**

Add this function after the `getClient` function (around line 38):

```ts
function revalidateFeed(
  key: string,
  source: ContentSource,
  feedId: string,
  tag: string | null,
): void {
  const myRequest = ++requestId
  const client = getClient(source)

  const fetchPromise = tag && client.fetchTag
    ? client.fetchTag(tag, 0)
    : client.fetchFeed(feedId, 0)

  fetchPromise.then((result) => {
    if (myRequest !== requestId) return
    items = result
    cache.set(key, { items: result, currentPage: 0, exhausted: result.length === 0, fetchedAt: Date.now() })
  }).catch(() => {
    // On failure, keep stale data — do nothing
  })
}
```

- [ ] **Step 3: Add revalidateOmnifeed helper for background re-fetch of omnifeed**

Add this function after `revalidateFeed`:

```ts
function revalidateOmnifeed(key: string, mode: OmnifeedMode): void {
  const myRequest = ++requestId

  fetchAllSources(mode, 0).then((results) => {
    if (myRequest !== requestId) return
    const feedsBySource: Partial<Record<ContentSource, FeedItem[]>> = {}
    allSourceIds.forEach((id, i) => { feedsBySource[id] = results[i] })
    const merged = mergeFeeds(feedsBySource, sortForMode(mode))
    items = merged
    cache.set(key, { items: merged, currentPage: 0, exhausted: false, fetchedAt: Date.now() })
  }).catch(() => {
    // On failure, keep stale data
  })
}
```

Note: `sortForMode` is defined later in the file — move its definition above these helpers, or define the helpers after it. The simplest approach: place both `revalidateFeed` and `revalidateOmnifeed` right after the `sortForMode` function (currently around line 124).

- [ ] **Step 4: Modify loadFeed for stale-while-revalidate**

Find the cache-hit block in `loadFeed`:
```ts
  const cached = cache.get(key)
  if (cached) {
    items = cached.items
    loading = false
    return
  }
```

Replace with:
```ts
  const cached = cache.get(key)
  if (cached) {
    items = cached.items
    loading = false
    if (isCacheStale(cached)) {
      revalidateFeed(key, source, feedId, tag ?? null)
    }
    return
  }
```

- [ ] **Step 5: Stamp fetchedAt on cache writes in loadFeed**

Find the cache.set call in the try block of `loadFeed`:
```ts
    cache.set(key, { items: result, currentPage: 0, exhausted: result.length === 0 })
```

Replace with:
```ts
    cache.set(key, { items: result, currentPage: 0, exhausted: result.length === 0, fetchedAt: Date.now() })
```

- [ ] **Step 6: Modify loadOmnifeed for stale-while-revalidate**

Find the cache-hit block in `loadOmnifeed`:
```ts
  const cached = cache.get(key)
  if (cached) {
    currentKey = key
    items = cached.items
    return
  }
```

Replace with:
```ts
  const cached = cache.get(key)
  if (cached) {
    currentKey = key
    items = cached.items
    if (isCacheStale(cached)) {
      revalidateOmnifeed(key, mode)
    }
    return
  }
```

- [ ] **Step 7: Stamp fetchedAt on cache writes in loadOmnifeed**

Find the cache.set call in `loadOmnifeed`:
```ts
    cache.set(key, { items: merged, currentPage: 0, exhausted: false })
```

Replace with:
```ts
    cache.set(key, { items: merged, currentPage: 0, exhausted: false, fetchedAt: Date.now() })
```

- [ ] **Step 8: Stamp fetchedAt on cache writes in refreshFeed**

Find the cache.set call in `refreshFeed` (the one inside the try block):
```ts
    cache.set(currentKey, { items: result, currentPage: 0, exhausted: result.length === 0 })
```

Replace with:
```ts
    cache.set(currentKey, { items: result, currentPage: 0, exhausted: result.length === 0, fetchedAt: Date.now() })
```

- [ ] **Step 9: Run all tests**

Run: `cd packages/web && pnpm vitest run tests/feed-cache.test.ts`

Expected: All tests pass.

Run: `cd packages/web && pnpm vitest run`

Expected: All existing tests still pass (no regressions).

- [ ] **Step 10: Commit**

```bash
git add packages/web/src/lib/feed.svelte.ts
git commit -m "feat: add TTL and stale-while-revalidate to feed cache"
```

---

### Task 5: Run full test suite and type check

**Files:** None (verification only)

- [ ] **Step 1: Run core tests**

Run: `cd packages/core && pnpm vitest run`

Expected: All tests pass (core package is unchanged).

- [ ] **Step 2: Run web tests**

Run: `cd packages/web && pnpm vitest run`

Expected: All tests pass including new feed-cache tests.

- [ ] **Step 3: Run type check**

Run: `cd packages/web && pnpm check`

Expected: No type errors.

- [ ] **Step 4: Run build**

Run: `cd packages/web && pnpm build`

Expected: Clean build.

---

### Task 6: Manual browser verification

**Files:** None (verification only)

Start the dev server and verify the feature works in a real browser.

- [ ] **Step 1: Start dev server**

Run: `cd packages/web && pnpm dev`

- [ ] **Step 2: Verify navigation caching**

Using playwright-cli:
1. Open `http://localhost:5174`
2. Wait for omnifeed to load
3. Click into a per-source view (HN)
4. Click back to omnifeed — should be instant (no loading spinner)
5. Click into Lobsters view
6. Click back to omnifeed — still instant

- [ ] **Step 3: Verify refresh evicts cache**

1. On any feed, click the refresh button
2. Should see loading spinner
3. Fresh data loads

- [ ] **Step 4: Check console for errors**

Run: `playwright-cli console error`

Expected: 0 errors.
