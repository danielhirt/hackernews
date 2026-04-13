# Unified Omnifeed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-source default view with a unified feed merging all sources chronologically, with source filter chips and mode tabs.

**Architecture:** Parallel fetch from all 3 source clients + client-side merge via a pure `mergeFeeds` function in `packages/core`. New `loadOmnifeed` function in the feed store handles the multi-source fetch/merge/cache cycle. FeedControls gains omnifeed-specific controls (mode tabs, source chips) via conditional props.

**Tech Stack:** TypeScript, SvelteKit 2, Svelte 5 runes, Vitest, Playwright

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `packages/core/src/omnifeed.ts` | `mergeFeeds` pure function, `OmnifeedMode`, `FeedView`, `OMNIFEED_MAP` |
| Create | `packages/core/tests/omnifeed.test.ts` | Unit tests for mergeFeeds and OMNIFEED_MAP |
| Modify | `packages/core/src/index.ts` | Re-export omnifeed module |
| Modify | `packages/web/src/lib/feed.svelte.ts` | `loadOmnifeed`, omnifeed pagination in `loadMore`, state additions |
| Modify | `packages/web/src/components/FeedControls.svelte` | Mode tabs, source filter chips, conditional layout |
| Modify | `packages/web/src/routes/+page.svelte` | Default to omnifeed, source filter state, integration |
| Modify | `packages/web/src/components/NavBar.svelte` | Omnifeed nav link, conditional feed tabs |
| Create | `packages/web/tests/omnifeed-filter.test.ts` | Unit tests for source filtering logic |

---

### Task 1: Core types and mergeFeeds (TDD)

**Files:**
- Create: `packages/core/tests/omnifeed.test.ts`
- Create: `packages/core/src/omnifeed.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests for mergeFeeds**

```typescript
// packages/core/tests/omnifeed.test.ts
import { describe, it, expect } from 'vitest'
import { mergeFeeds, OMNIFEED_MAP, type OmnifeedMode, type FeedView } from '../src/omnifeed.js'
import type { FeedItem, ContentSource } from '../src/models.js'
import { SOURCES, FEED_ENDPOINTS } from '../src/models.js'

function makeFeedItem(overrides: Partial<FeedItem> & { timestamp: number; source: ContentSource }): FeedItem {
  return {
    id: `${overrides.source === 'hackernews' ? 'hn' : overrides.source === 'lobsters' ? 'lo' : 'dev'}:${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test item',
    score: 10,
    author: 'testuser',
    commentCount: 5,
    sourceUrl: 'https://example.com',
    ...overrides,
  }
}

describe('mergeFeeds', () => {
  it('sorts items from multiple sources by timestamp descending', () => {
    const items = mergeFeeds({
      hackernews: [makeFeedItem({ source: 'hackernews', timestamp: 100 })],
      lobsters: [makeFeedItem({ source: 'lobsters', timestamp: 300 })],
      devto: [makeFeedItem({ source: 'devto', timestamp: 200 })],
    })
    expect(items.map(i => i.timestamp)).toEqual([300, 200, 100])
    expect(items.map(i => i.source)).toEqual(['lobsters', 'devto', 'hackernews'])
  })

  it('handles empty sources', () => {
    const items = mergeFeeds({
      hackernews: [],
      lobsters: [makeFeedItem({ source: 'lobsters', timestamp: 100 })],
      devto: [],
    })
    expect(items).toHaveLength(1)
    expect(items[0].source).toBe('lobsters')
  })

  it('handles partial source map (missing sources)', () => {
    const items = mergeFeeds({
      hackernews: [makeFeedItem({ source: 'hackernews', timestamp: 100 })],
    })
    expect(items).toHaveLength(1)
  })

  it('handles empty input', () => {
    const items = mergeFeeds({})
    expect(items).toEqual([])
  })

  it('does not mutate input arrays', () => {
    const hn = [makeFeedItem({ source: 'hackernews', timestamp: 100 })]
    const lo = [makeFeedItem({ source: 'lobsters', timestamp: 200 })]
    const hnCopy = [...hn]
    const loCopy = [...lo]
    mergeFeeds({ hackernews: hn, lobsters: lo })
    expect(hn).toEqual(hnCopy)
    expect(lo).toEqual(loCopy)
  })

  it('interleaves items from same source correctly', () => {
    const items = mergeFeeds({
      hackernews: [
        makeFeedItem({ source: 'hackernews', timestamp: 300 }),
        makeFeedItem({ source: 'hackernews', timestamp: 100 }),
      ],
      lobsters: [
        makeFeedItem({ source: 'lobsters', timestamp: 200 }),
      ],
    })
    expect(items.map(i => i.timestamp)).toEqual([300, 200, 100])
  })
})

describe('OMNIFEED_MAP', () => {
  const modes: OmnifeedMode[] = ['newest', 'hottest']

  it('maps every mode to all three sources', () => {
    for (const mode of modes) {
      expect(OMNIFEED_MAP[mode]).toHaveProperty('hackernews')
      expect(OMNIFEED_MAP[mode]).toHaveProperty('lobsters')
      expect(OMNIFEED_MAP[mode]).toHaveProperty('devto')
    }
  })

  it('maps to valid HN feed IDs', () => {
    for (const mode of modes) {
      const feedId = OMNIFEED_MAP[mode].hackernews
      expect(FEED_ENDPOINTS).toHaveProperty(feedId)
    }
  })

  it('maps to valid Lobsters feed IDs', () => {
    const validLobsters = SOURCES.find(s => s.id === 'lobsters')!.feeds.map(f => f.id)
    for (const mode of modes) {
      expect(validLobsters).toContain(OMNIFEED_MAP[mode].lobsters)
    }
  })

  it('maps to valid DEV.to feed IDs', () => {
    const validDevto = SOURCES.find(s => s.id === 'devto')!.feeds.map(f => f.id)
    for (const mode of modes) {
      expect(validDevto).toContain(OMNIFEED_MAP[mode].devto)
    }
  })
})

describe('FeedView type', () => {
  it('accepts ContentSource values', () => {
    const view: FeedView = 'hackernews'
    expect(view).toBe('hackernews')
  })

  it('accepts omnifeed', () => {
    const view: FeedView = 'omnifeed'
    expect(view).toBe('omnifeed')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/core test -- --run omnifeed`
Expected: FAIL — cannot resolve `../src/omnifeed.js`

- [ ] **Step 3: Implement mergeFeeds and types**

```typescript
// packages/core/src/omnifeed.ts
import type { ContentSource, FeedItem } from './models.js'

export type OmnifeedMode = 'newest' | 'hottest'

export type FeedView = ContentSource | 'omnifeed'

export const OMNIFEED_MAP: Record<OmnifeedMode, Record<ContentSource, string>> = {
  newest: { hackernews: 'new', lobsters: 'newest', devto: 'latest' },
  hottest: { hackernews: 'top', lobsters: 'hottest', devto: 'top' },
}

export function mergeFeeds(
  feedsBySource: Partial<Record<ContentSource, FeedItem[]>>
): FeedItem[] {
  return (Object.values(feedsBySource) as FeedItem[][])
    .flat()
    .sort((a, b) => b.timestamp - a.timestamp)
}
```

- [ ] **Step 4: Add export to core index**

Add to `packages/core/src/index.ts`:
```typescript
export * from './omnifeed.js'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/core test -- --run omnifeed`
Expected: All tests PASS

- [ ] **Step 6: Run full core test suite for regression**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/core test -- --run`
Expected: All existing tests still pass

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/omnifeed.ts packages/core/src/index.ts packages/core/tests/omnifeed.test.ts
git commit -m "feat: add mergeFeeds, OmnifeedMode, FeedView types in core"
```

---

### Task 2: Feed store — omnifeed loading

**Files:**
- Modify: `packages/web/src/lib/feed.svelte.ts`

Read `packages/web/src/lib/feed.svelte.ts` fully before modifying. The changes below reference the structure from exploration — verify exact line numbers match.

- [ ] **Step 1: Add imports**

Add to existing imports at top of `feed.svelte.ts`:

```typescript
import {
  type OmnifeedMode,
  type FeedView,
  OMNIFEED_MAP,
  mergeFeeds,
  SOURCES,
} from '@omnifeed/core'
```

Note: `createSourceClient` and `type ContentSource` are already imported. `SOURCES` may need adding.

- [ ] **Step 2: Add omnifeed state variables**

After the existing state variables (`currentTag`, around line 37), add:

```typescript
let currentView = $state<FeedView>('omnifeed')
let omnifeedMode = $state<OmnifeedMode>('newest')
```

- [ ] **Step 3: Update getFeedState to expose new state**

In the `getFeedState()` return object, add these getters alongside existing ones:

```typescript
get view() { return currentView },
get omnifeedMode() { return omnifeedMode },
```

- [ ] **Step 4: Add loadOmnifeed function**

Add after the `loadFeed` function:

```typescript
export async function loadOmnifeed(mode: OmnifeedMode) {
  const key = `omnifeed:${mode}`
  omnifeedMode = mode
  currentView = 'omnifeed'

  // Check cache
  const cached = feedCache.get(key)
  if (cached && currentKey === key) {
    items = cached.items
    return
  }

  currentKey = key
  loading = true
  items = []
  const myRequestId = ++requestId

  try {
    const sourceIds: ContentSource[] = ['hackernews', 'lobsters', 'devto']
    const feedMap = OMNIFEED_MAP[mode]

    const results = await Promise.all(
      sourceIds.map(async (sourceId) => {
        try {
          const client = getClient(sourceId)
          return await client.fetchFeed(feedMap[sourceId], 0)
        } catch (err) {
          console.error(`Failed to fetch ${sourceId}:`, err)
          return [] as FeedItem[]
        }
      })
    )

    if (myRequestId !== requestId) return

    const feedsBySource: Partial<Record<ContentSource, FeedItem[]>> = {}
    sourceIds.forEach((id, i) => { feedsBySource[id] = results[i] })
    const merged = mergeFeeds(feedsBySource)

    items = merged
    feedCache.set(key, { items: merged, currentPage: 0, exhausted: false })
  } finally {
    if (myRequestId === requestId) loading = false
  }
}
```

- [ ] **Step 5: Update loadFeed to set currentView**

At the top of the existing `loadFeed` function body, add:

```typescript
currentView = source
```

This ensures navigating to a per-source view clears the omnifeed view state.

- [ ] **Step 6: Update loadMore for omnifeed pagination**

In the `loadMore` function, add an omnifeed branch. Before the existing single-source fetch logic (the part that calls `client.fetchFeed`), add a check:

```typescript
if (currentView === 'omnifeed') {
  const sourceIds: ContentSource[] = ['hackernews', 'lobsters', 'devto']
  const feedMap = OMNIFEED_MAP[omnifeedMode]

  const results = await Promise.all(
    sourceIds.map(async (sourceId) => {
      try {
        const client = getClient(sourceId)
        return await client.fetchFeed(feedMap[sourceId], cached.currentPage + 1)
      } catch {
        return [] as FeedItem[]
      }
    })
  )

  const newItems = results.flat()

  if (newItems.length === 0) {
    cached.exhausted = true
  } else {
    cached.currentPage++
    cached.items = [...cached.items, ...newItems].sort((a, b) => b.timestamp - a.timestamp)
    items = cached.items
  }

  loadingMore = false
  loadMoreCooldown = true
  setTimeout(() => { loadMoreCooldown = false }, 5000)
  return
}
```

- [ ] **Step 7: Update refreshFeed for omnifeed**

In the `refreshFeed` function, add an omnifeed branch. After the `if (customRefresh)` check and before the single-source refresh:

```typescript
if (currentView === 'omnifeed') {
  feedCache.delete(currentKey)
  await loadOmnifeed(omnifeedMode)
  return
}
```

- [ ] **Step 8: Export loadOmnifeed**

The function is already `export async function`, so it's automatically exported. Verify it's accessible from the page.

- [ ] **Step 9: Build and type-check**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/web check`
Expected: No type errors

- [ ] **Step 10: Commit**

```bash
git add packages/web/src/lib/feed.svelte.ts
git commit -m "feat: add loadOmnifeed with parallel fetch, merge, pagination"
```

---

### Task 3: FeedControls — omnifeed mode and source filter

**Files:**
- Modify: `packages/web/src/components/FeedControls.svelte`

Read `packages/web/src/components/FeedControls.svelte` before modifying.

- [ ] **Step 1: Add omnifeed types to module script**

Update the module script block:

```svelte
<script lang="ts" module>
  export type FeedFilter = 'all' | 'unread' | 'saved'
  export type SourceFilter = 'all' | 'hackernews' | 'lobsters' | 'devto'
</script>
```

- [ ] **Step 2: Add new props**

Update the props destructuring to accept optional omnifeed controls:

```typescript
import type { OmnifeedMode } from '@omnifeed/core'

let {
  filter = $bindable<FeedFilter>('all'),
  sourceFilter = $bindable<SourceFilter>('all'),
  omnifeedMode = $bindable<OmnifeedMode>('newest'),
  isOmnifeed = false,
  children,
}: {
  filter: FeedFilter
  sourceFilter?: SourceFilter
  omnifeedMode?: OmnifeedMode
  isOmnifeed?: boolean
  children?: Snippet
} = $props()
```

- [ ] **Step 3: Update template with omnifeed controls**

Replace the template:

```svelte
<div class="feed-controls">
  {#if children}{@render children()}{/if}
  {#if isOmnifeed}
    <button
      class="mode-btn"
      class:active={omnifeedMode === 'newest'}
      onclick={() => omnifeedMode = 'newest'}
    >Newest</button>
    <button
      class="mode-btn"
      class:active={omnifeedMode === 'hottest'}
      onclick={() => omnifeedMode = 'hottest'}
    >Hottest</button>
    <span class="filter-sep">|</span>
    <button
      class="source-btn"
      class:active={sourceFilter === 'all'}
      onclick={() => sourceFilter = 'all'}
    >All</button>
    <button
      class="source-btn compact"
      class:active={sourceFilter === 'hackernews'}
      onclick={() => sourceFilter = 'hackernews'}
    >HN</button>
    <button
      class="source-btn compact"
      class:active={sourceFilter === 'lobsters'}
      onclick={() => sourceFilter = 'lobsters'}
    >Lobsters</button>
    <button
      class="source-btn compact"
      class:active={sourceFilter === 'devto'}
      onclick={() => sourceFilter = 'devto'}
    >DEV</button>
    <span class="filter-sep">|</span>
  {/if}
  <button
    class="filter-btn"
    class:active={filter === 'all'}
    onclick={() => filter = 'all'}
  >All</button>
  <button
    class="filter-btn compact"
    class:active={filter === 'unread'}
    onclick={() => filter = 'unread'}
  >Unread</button>
  <button
    class="filter-btn compact"
    class:active={filter === 'saved'}
    onclick={() => filter = 'saved'}
  >Saved</button>
  <span class="filter-sep">|</span>
  <button class="refresh-btn" onclick={refreshFeed} title="Refresh feed (r)">↻</button>
</div>
```

- [ ] **Step 4: Add CSS for new controls**

Add to the `<style>` block:

```css
.mode-btn {
  font-size: 0.75rem;
  color: var(--color-text-faint);
  padding: 2px 5px;
  border: 1px solid transparent;
}

.mode-btn:hover {
  color: var(--color-text);
}

.mode-btn.active {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.source-btn {
  font-size: 0.75rem;
  color: var(--color-text-faint);
  padding: 2px 5px;
  border: 1px solid transparent;
}

.source-btn:hover {
  color: var(--color-text);
}

.source-btn.compact {
  padding: 2px 3px;
}

.source-btn.active {
  color: var(--color-accent);
  border-color: var(--color-accent);
}
```

- [ ] **Step 5: Type-check**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/web check`
Expected: No type errors (FeedControls is used in +page.svelte which will need updating, so warnings about unused props are OK at this stage)

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/FeedControls.svelte
git commit -m "feat: add omnifeed mode tabs and source filter chips to FeedControls"
```

---

### Task 4: +page.svelte — omnifeed as default view

**Files:**
- Modify: `packages/web/src/routes/+page.svelte`

Read `packages/web/src/routes/+page.svelte` fully before modifying.

- [ ] **Step 1: Update imports**

Add to existing imports:

```typescript
import { type OmnifeedMode, type FeedView } from '@omnifeed/core'
import { loadOmnifeed } from '$lib/feed.svelte'
import { type SourceFilter } from '../components/FeedControls.svelte'
```

Note: `loadFeed`, `loadMore`, `getFeedState` are already imported.

- [ ] **Step 2: Add omnifeed-aware derived state**

Replace the `source` derived (which currently defaults to `'hackernews'`):

```typescript
let sourceParam = $derived(
  new URLSearchParams(page.url.search).get('source') as ContentSource | null
)

let isOmnifeed = $derived(sourceParam === null)

let source: ContentSource = $derived(sourceParam ?? 'hackernews')
```

The key change: when no `?source` param, `isOmnifeed` is true.

- [ ] **Step 3: Add omnifeed state variables**

After the existing `feedFilter` state:

```typescript
let omnifeedMode = $state<OmnifeedMode>('newest')
let sourceFilter = $state<SourceFilter>('all')
```

- [ ] **Step 4: Update filteredItems to include source filter**

Replace the existing `filteredItems` derived:

```typescript
let filteredItems = $derived.by(() => {
  let result = feed.items
  if (sourceFilter !== 'all') {
    result = result.filter(item => item.source === sourceFilter)
  }
  if (feedFilter === 'unread') return result.filter(item => !isRead(item.id))
  if (feedFilter === 'saved') return result.filter(item => savedIds.has(item.id))
  return result
})
```

- [ ] **Step 5: Update the load effect**

Replace the existing `$effect(() => { loadFeed(source, feedId, tag) })`:

```typescript
$effect(() => {
  if (isOmnifeed) {
    loadOmnifeed(omnifeedMode)
  } else {
    loadFeed(source, feedId, tag)
  }
})
```

- [ ] **Step 6: Reset filters on view change**

Update the existing filter reset effect:

```typescript
$effect(() => {
  source; feedId; tag; isOmnifeed; omnifeedMode;
  feedFilter = 'all'
  sourceFilter = 'all'
})
```

- [ ] **Step 7: Update FeedControls usage in template**

Replace the existing `<FeedControls>` block (the non-search-active branch):

```svelte
<FeedControls
  bind:filter={feedFilter}
  bind:sourceFilter={sourceFilter}
  bind:omnifeedMode={omnifeedMode}
  {isOmnifeed}
>
  {#if isHn && !isOmnifeed}
    <form class="search-form" onsubmit={handleSearchSubmit}>
      <span class="search-field">
        <span class="search-icon">⌕</span>
        <input
          bind:this={searchInput}
          class="search-input"
          type="text"
          placeholder="Search HN..."
          bind:value={searchInputValue}
          onfocus={() => searchFocused = true}
          onblur={() => { if (!searchActive) searchFocused = false }}
          onkeydown={(e) => { if (e.key === 'Escape') { if (searchActive) clearSearch(); else { searchFocused = false; searchInputValue = ''; searchInput?.blur() } } }}
        />
      </span>
      {#if searchFocused}
        <button class="search-btn" type="submit">Search</button>
      {/if}
    </form>
  {/if}
</FeedControls>
```

Key change: search form hidden when `isOmnifeed` is true.

- [ ] **Step 8: Hide search controls bar in omnifeed mode**

In the search-active controls section at the top of the template, add omnifeed guard. The `{#if searchActive && searchQuery}` block should also check `!isOmnifeed`:

```svelte
{#if !isOmnifeed && searchActive && searchQuery}
```

- [ ] **Step 9: Type-check**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/web check`
Expected: No type errors

- [ ] **Step 10: Commit**

```bash
git add packages/web/src/routes/+page.svelte
git commit -m "feat: default to omnifeed view with source filtering and mode switching"
```

---

### Task 5: NavBar — omnifeed navigation

**Files:**
- Modify: `packages/web/src/components/NavBar.svelte`

Read `packages/web/src/components/NavBar.svelte` fully before modifying.

- [ ] **Step 1: Add omnifeed detection**

In the script section, after the existing `currentSource` derived, add:

```typescript
let isOmnifeed = $derived(
  page.url.pathname === '/' && !new URLSearchParams(page.url.search).has('source')
)
```

Import `page` from `$app/state` if not already imported.

- [ ] **Step 2: Add omnifeed link**

In the source-selector area, add an "Omnifeed" option. The app title or a dedicated button should link to `/` (no params). Modify the source-selector to include:

```svelte
<a class="source-name" href="/" class:active={isOmnifeed}>Omnifeed</a>
```

This goes before or replaces the current source name display when in omnifeed mode. The exact placement depends on the current NavBar template — read it first.

- [ ] **Step 3: Conditionally show feed tabs**

The feed-tabs section currently shows per-source tabs (top/new/best etc.). When `isOmnifeed` is true, hide these tabs since mode switching is handled by FeedControls:

```svelte
{#if !isOmnifeed}
  <div class="feed-tabs">
    {#each sourceConfig?.feeds ?? [] as f}
      <a
        class="feed-tab"
        class:active={f.id === currentFeed}
        href="/?source={currentSource}&feed={f.id}"
      >{f.label}</a>
    {/each}
  </div>
{/if}
```

- [ ] **Step 4: Type-check**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/web check`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/NavBar.svelte
git commit -m "feat: add omnifeed nav link, hide feed tabs in omnifeed mode"
```

---

### Task 6: Source filter unit tests (TDD)

**Files:**
- Create: `packages/web/tests/omnifeed-filter.test.ts`

- [ ] **Step 1: Write source filter tests**

```typescript
// packages/web/tests/omnifeed-filter.test.ts
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
```

Note: The filter logic is inline in +page.svelte's `filteredItems` derived. These tests validate the filtering concept. The actual integration is tested via Playwright.

- [ ] **Step 2: Run tests**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/web test -- --run omnifeed-filter`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/omnifeed-filter.test.ts
git commit -m "test: add source filter unit tests for omnifeed"
```

---

### Task 7: Full test suite and type-check

**Files:** None (verification only)

- [ ] **Step 1: Run all core tests**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/core test -- --run`
Expected: All pass including new omnifeed tests

- [ ] **Step 2: Run all web tests**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/web test -- --run`
Expected: All pass including new filter tests

- [ ] **Step 3: Type-check both packages**

Run: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/core check && pnpm --filter @omnifeed/web check`
Expected: No type errors

- [ ] **Step 4: Fix any failures**

If tests fail, diagnose and fix before proceeding. Common issues:
- Import paths using `.js` extension (required for core package ESM)
- FeedControls prop type changes breaking existing usage
- Feed state shape changes affecting consumers

- [ ] **Step 5: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve test and type-check issues from omnifeed integration"
```

---

### Task 8: Playwright verification

**Files:** None (verification only)

Start the dev server first: `cd /Users/daniel/Development/omnifeed && pnpm --filter @omnifeed/web dev`

- [ ] **Step 1: Verify default landing page is omnifeed**

```bash
playwright-cli open http://localhost:5174
playwright-cli snapshot
```

Verify: The page loads with items from multiple sources (check for mixed `hn:`, `lo:`, `dev:` prefixes or source indicators on cards). FeedControls shows mode tabs (Newest/Hottest) and source chips (All/HN/Lobsters/DEV).

- [ ] **Step 2: Test mode switching**

Click the "Hottest" mode tab. Verify items reload. Click "Newest" to switch back.

```bash
playwright-cli snapshot
# Find the Hottest button ref
playwright-cli click <hottest-ref>
playwright-cli snapshot
```

- [ ] **Step 3: Test source filter chips**

Click "HN" source chip. Verify only HN items shown. Click "All" to reset.

```bash
playwright-cli click <hn-chip-ref>
playwright-cli snapshot
# Verify all visible items are from HN
playwright-cli click <all-chip-ref>
playwright-cli snapshot
```

- [ ] **Step 4: Test unread/saved filters with source filter**

Apply source filter (e.g., "Lobsters"), then apply "Unread" filter. Verify both filters compose.

- [ ] **Step 5: Test per-source navigation**

Use the navbar dropdown to navigate to a specific source (e.g., `/?source=hackernews`). Verify:
- Feed tabs appear (top/new/best etc.)
- Mode tabs and source chips are gone
- Search bar appears (HN only)
- Feed loads single-source items

```bash
playwright-cli goto http://localhost:5174/?source=hackernews
playwright-cli snapshot
```

- [ ] **Step 6: Test navigation back to omnifeed**

Click the "Omnifeed" link in the navbar. Verify return to unified view.

- [ ] **Step 7: Test keyboard navigation**

Press `j`/`k` to navigate items in the unified feed. Press `o` to open an item detail. Press back. Verify feed state preserved.

- [ ] **Step 8: Test infinite scroll**

Scroll to bottom of unified feed. Verify more items load (skeleton cards appear, then real items).

- [ ] **Step 9: Test item detail from omnifeed**

Click a Lobsters item from the unified feed. Verify item detail page loads correctly. Navigate back. Verify unified feed state preserved.

- [ ] **Step 10: Regression — per-source views**

Navigate to each source individually and verify feeds load:

```bash
playwright-cli goto http://localhost:5174/?source=hackernews
playwright-cli snapshot
playwright-cli goto http://localhost:5174/?source=lobsters
playwright-cli snapshot
playwright-cli goto http://localhost:5174/?source=devto
playwright-cli snapshot
```

- [ ] **Step 11: Regression — collections page**

Navigate to collections. Verify collections page loads, saved items display correctly.

- [ ] **Step 12: Close browser**

```bash
playwright-cli close
```
