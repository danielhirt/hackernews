# Unified Omnifeed

## Overview

Replace the single-source default view with a unified feed that merges items from all sources (Hacker News, Lobsters, DEV.to) into one chronologically sorted stream. Source-specific views remain accessible via the navbar dropdown.

## Decisions

- **Default view:** `/` with no `?source` param renders the unified omnifeed
- **Sort order:** Chronological (newest first) as the base sort
- **Architecture:** Parallel fetch from all sources + client-side merge. Merge logic lives in `packages/core` as a pure function so a future server endpoint can reuse it without rewrite.
- **Feed type aggregation:** Two modes that map to aligned sub-feeds across sources:
  - **Newest** → HN "new" + Lobsters "newest" + DEV "latest"
  - **Hottest** → HN "top" + Lobsters "hottest" + DEV "top"
  - "Active" skipped for v1 (only Lobsters has a native active feed)
- **Source filtering:** Client-side filter on the unified page (not navigation to per-source views)
- **Per-source views:** Still exist, accessed via navbar source dropdown

## Data Layer (`packages/core`)

### New types

```typescript
type OmnifeedMode = 'newest' | 'hottest'

type FeedView = ContentSource | 'omnifeed'

const OMNIFEED_MAP: Record<OmnifeedMode, Record<ContentSource, string>> = {
  newest: { hackernews: 'new', lobsters: 'newest', devto: 'latest' },
  hottest: { hackernews: 'top', lobsters: 'hottest', devto: 'top' },
}
```

### Pure merge function

```typescript
function mergeFeeds(feedsBySource: Record<ContentSource, FeedItem[]>): FeedItem[] {
  return Object.values(feedsBySource).flat().sort((a, b) => b.timestamp - a.timestamp)
}
```

Lives in `packages/core` with no Svelte dependencies. Takes arrays in, returns a sorted array. A future server endpoint imports this same function.

`ContentSource` stays unchanged (HN/Lobsters/DEV). `FeedView` lives in `packages/core/src/models.ts` alongside `ContentSource`. It adds `'omnifeed'` as a composite view type.

## Feed State & Loading (`packages/web/src/lib/feed.svelte.ts`)

### Omnifeed load path

When the view is `'omnifeed'`, `loadFeed`:

1. Reads the current `OmnifeedMode` to determine which sub-feed to pull per source
2. Fires three parallel fetches (one per source client) using the mapped sub-feed IDs from `OMNIFEED_MAP`
3. Passes results to `mergeFeeds()` from core
4. Sets `feed.items` to the merged, sorted array

### Caching

Cache key: `omnifeed:newest` or `omnifeed:hottest`. Same structure as today (items + currentPage + exhausted). `exhausted` is true only when all three sources report exhausted.

### Pagination

`loadMore` fetches the next page from all three sources in parallel, appends to existing items, re-sorts the full array. Exhausted sources are skipped in subsequent pages.

### State additions

- `currentView: FeedView` — when `'omnifeed'`, composite logic runs. When a specific `ContentSource`, behaves identically to today.
- `omnifeedMode: OmnifeedMode` — tracks newest vs hottest for the unified feed.

### Backward compatibility

Navigating to a per-source view via the navbar dropdown sets `currentView` to a specific `ContentSource`. The per-source code path is unchanged.

## UI — Controls & Routing

### Default route (`/`)

No `?source` param means omnifeed. Adding `?source=hackernews` navigates to the dedicated HN view as today.

### FeedControls bar in omnifeed mode

Left to right:
1. **Mode tabs:** Newest | Hottest (replaces per-source feed tabs)
2. **Source filter chips:** All | HN | Lobsters | DEV — filters the merged array client-side, same pattern as unread/saved
3. **Separator `|`**
4. **Existing filters:** All | Unread | Saved
5. **Separator `|`**
6. **Refresh `↻`**

### NavBar changes

- Source dropdown stays, still links to dedicated per-source views
- "Omnifeed" entry (or app title/logo link) navigates to `/` (unified view)
- Feed tabs row beneath navbar: Newest | Hottest in omnifeed mode, per-source tabs (top/new/best/etc.) in dedicated source view

### StoryCard

No changes. Each card already shows `item.source`, identifying where it came from.

### Search

HN search (Algolia) is source-specific. In omnifeed mode, the search bar is hidden. It remains visible in the dedicated HN per-source view.

### Keyboard nav, infinite scroll

Both work unchanged. They operate on `filteredItems`, which is a filtered/sorted `FeedItem[]` regardless of origin.

## Testing

### Unit tests (`packages/web/tests/`)

- `mergeFeeds`: items from 3 sources sorted by timestamp; handles empty sources; handles one source returning no items
- `OMNIFEED_MAP`: each mode maps to valid feed IDs for each source
- Feed store omnifeed path: loading sets correct state, `loadMore` appends and re-sorts, exhausted-source skipping, cache key format
- Source filter on unified feed: "All" shows everything, "HN" shows only HN items, combined with unread/saved filters

### Playwright verification

- Default landing page loads unified feed with items from multiple sources
- Mode switching (newest/hottest) reloads feed
- Source filter chips narrow visible items
- Unread/saved filters work within filtered view
- Navbar dropdown navigates to dedicated per-source view and back
- Keyboard navigation works on unified feed
- Infinite scroll loads more items

### Regression

- Per-source views work identically (navigate via dropdown, verify feed loads)
- Item detail pages work from unified feed items
- Collections/saved state unaffected
