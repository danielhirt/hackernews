# Feed Cache TTL & Stale-While-Revalidate

## Problem

The web-layer feed cache (`feed.svelte.ts`) has no TTL. A feed visited at session start serves the same data hours later without a manual refresh. Additionally, only HN benefits from the core `TtlCache`; Lobsters and DEV.to have no caching at the source-client level.

## Goals

1. **All feeds cached on first load** — navigation between feeds is instant (served from cache)
2. **TTL-based staleness** — cached data expires after a configurable duration
3. **Stale-while-revalidate** — when a cache entry is stale, show cached data immediately and re-fetch in the background
4. **Explicit refresh always evicts** — `refreshFeed()` clears the cache entry and fetches fresh, ignoring TTL
5. **Performance first** — no regression in navigation speed; cache hits remain instant

## Design

### Where the TTL lives

The `FeedCache` interface in `packages/web/src/lib/feed.svelte.ts` gains a `fetchedAt` timestamp:

```ts
interface FeedCache {
  items: FeedItem[]
  currentPage: number
  exhausted: boolean
  fetchedAt: number  // Date.now() when the cache entry was created/refreshed
}
```

### TTL constant

```ts
const FEED_CACHE_TTL = 5 * 60 * 1000  // 5 minutes
```

This matches the existing HN core-level TTL and is a reasonable default for news feed freshness.

### Cache read behavior

A new helper determines if a cache entry is stale:

```ts
function isCacheStale(entry: FeedCache): boolean {
  return Date.now() - entry.fetchedAt >= FEED_CACHE_TTL
}
```

### Navigation flow (loadFeed / loadOmnifeed)

On navigation to a feed:

1. Check `cache.get(key)`
2. If **hit and fresh**: serve from cache, return (current behavior)
3. If **hit and stale**: serve cached `items` immediately (no loading spinner), then kick off a background re-fetch of page 0 only. When the re-fetch resolves, update `items` and reset the cache entry with fresh `fetchedAt`, `currentPage: 0`, `exhausted` based on results.
4. If **miss**: show loading state, fetch, populate cache (current behavior)

### Background revalidation details

- Only re-fetches page 0. Users who have loaded pages 2-3 via `loadMore()` keep seeing those items until the revalidation replaces the cache entry.
- Uses the same `requestId` guard to avoid clobbering concurrent navigations.
- Does NOT set `loading = true` — the user sees no spinner during revalidation.
- On failure, the stale cache entry is kept (better to show stale data than nothing).

### Explicit refresh (refreshFeed)

No change to the eviction logic — `refreshFeed()` already deletes the cache key and clears underlying client caches. It will continue to show a loading spinner and fetch fresh. The only change: the new cache entry gets a `fetchedAt` timestamp.

### loadMore interaction

`loadMore()` does not update `fetchedAt`. Pagination extends the existing cache entry but doesn't reset its staleness clock. This means if you load 3 pages over 6 minutes, the next navigation to that feed will trigger a background revalidation of page 0, which is correct — the base data is stale even though you recently loaded more.

### What stays the same

- Core `TtlCache` in `packages/core/src/cache.ts` — unchanged, continues to serve HN item-level dedup
- `HnSourceAdapter.clearCache()` — called by `refreshFeed()` as before
- Lobsters/DEV.to source clients — no per-client caching added (the web-layer cache covers them uniformly)
- `summaries.svelte.ts`, `read-history.svelte.ts`, `idb-adapter.ts` — no changes

## Testing Strategy

### Unit tests (`packages/web/tests/feed-cache.test.ts`)

New test file exercising the cache behavior in isolation:

1. **Fresh cache hit**: navigate to feed, navigate away, navigate back — no re-fetch
2. **Stale cache triggers revalidation**: navigate to feed, advance time past TTL, navigate back — items served from cache immediately, then updated from re-fetch
3. **Explicit refresh always evicts**: regardless of TTL, refreshFeed clears cache and fetches fresh
4. **Background revalidation doesn't show loading state**: assert `loading` stays false during revalidation
5. **Background revalidation failure keeps stale data**: simulate fetch error after TTL, assert original items preserved
6. **loadMore doesn't reset fetchedAt**: load more, verify fetchedAt unchanged
7. **requestId guard prevents stale revalidation**: navigate away before revalidation resolves, assert items not clobbered

### Existing tests

- `packages/core/tests/cache.test.ts` — unaffected (TtlCache unchanged)
- `packages/core/tests/feeds.test.ts` — unaffected (FeedManager unchanged)

### Manual verification

After implementation, verify via dev server:
1. Load omnifeed, switch to HN, switch back — instant (cache hit)
2. Wait 5+ minutes, switch to a cached feed — items appear instantly, then update
3. Click refresh button — loading spinner, fresh data
4. Check browser console for errors during all flows
