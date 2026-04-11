# Lobsters Detail Page with Reusable Comment System

**Goal:** Add a Lobsters story detail page with threaded comments, matching all HN detail page features. Refactor the comment system to be source-agnostic and reusable.

**Scope:** Lobsters only. DEV.to and arXiv detail pages will follow the same pattern later.

---

## Architecture

### Unified Comment Type

```typescript
export interface CommentItem {
  id: string                      // "hn:123", "lo:abc"
  source: ContentSource
  text: string                    // HTML
  author: string
  timestamp: number               // Unix seconds
  score?: number                  // Lobsters has this, HN doesn't
  deleted?: boolean
  dead?: boolean
  children: CommentItem[]         // Pre-built tree, always resolved
  depth: number
  sourceUrl?: string              // Link to comment on source site
}
```

### Fetching vs Rendering Split

**Current:** `CommentTree` fetches HN comments by ID AND renders them.

**New:** Fetching moves to the page. Components only render.

- `CommentTree.svelte` — accepts `comments: CommentItem[]`, renders via `CommentNode`. No fetching, no `HnClient` import.
- `CommentNode.svelte` — renders one `CommentItem`, recursively renders `children` via `CommentTree`. Shows score if present. Source-aware author links.
- Each source's page handles fetching and tree-building before passing to `CommentTree`.

### HN Comment Fetching (moved to utility)

```typescript
// packages/core/src/comments.ts
export async function fetchHnCommentTree(
  client: HnClient,
  ids: number[],
  depth?: number,
  maxDepth?: number
): Promise<CommentItem[]>

export function hnCommentToItem(comment: Comment, depth: number): CommentItem
```

Recursively fetches HN comments via `HnClient.fetchItem()`, converts each to `CommentItem` with pre-built `children`. Called by the item detail page before rendering.

### Lobsters Story Fetch

```typescript
// packages/core/src/lobsters.ts
export class LobstersClient {
  // existing: fetchFeed()
  async fetchStory(shortId: string): Promise<{ story: FeedItem, comments: CommentItem[] }>
}
```

Fetches `/s/{shortId}.json` (via existing CORS proxy). Returns the story as `FeedItem` and converts the flat comment array to a nested `CommentItem[]` tree.

Tree-building algorithm: iterate the flat array (which comes in thread order from Lobsters), map each to `CommentItem`, use `parent_comment` field to attach to parent's `children` array.

### Route: `/item/[id]` Source-Aware

The existing route handles both sources by parsing the ID prefix:

- `/item/12345` — HN (no prefix = backward compat)
- `/item/lo:abc123` — Lobsters

Page logic:
1. Parse ID prefix to determine source
2. Fetch story + comments via source-specific client
3. Build `CommentItem[]` tree
4. Render same UI: header, actions, body, comment tree

### StoryCard Linking

Lobsters cards navigate to internal detail page:
```typescript
let hasDetailPage = $derived(item.source === 'hackernews' || item.source === 'lobsters')
let detailHref = $derived(hasDetailPage ? `/item/${item.id}` : item.sourceUrl)
```

### AI Summaries

Extend `/api/summarize` to accept generic item data:
```typescript
// New payload format (alongside existing HN format)
{
  title: string,
  url?: string,
  text?: string,
  comments?: { author: string, text: string }[],
  model: string
}
```

Lobsters page passes already-fetched story + comments directly. No redundant API calls.

### CommentNode Source Awareness

- Score display: `{#if comment.score !== undefined} <span>{comment.score}</span> {/if}`
- Author link: HN → `/user/{author}`, Lobsters → no internal profile (just text)
- Focus mode: works identically (CommentItem IDs are strings, focus stack uses strings)

---

## Feature Parity Table

| Feature | HN | Lobsters |
|---------|-----|----------|
| Story header (title, score, author, time) | Yes | Yes |
| External link (↗) | Yes | Yes |
| Save to collection (○/●) | Yes | Yes |
| AI summary (✦) | Yes | Yes (via generic endpoint) |
| Story body text | Yes (post text) | Yes (description) |
| Threaded comments | Yes | Yes |
| Collapse/expand comments | Yes | Yes |
| Focus mode (drill into subtree) | Yes | Yes |
| Copy comment text | Yes | Yes |
| Comment scores | No (HN hides these) | Yes |
| Tags display | No | Yes |
| Keyboard shortcuts | Yes | Yes |
| Read history | Yes | Yes |

---

## Files

### Core — New
| File | Purpose |
|------|---------|
| `packages/core/src/comments.ts` | `CommentItem` utilities: `fetchHnCommentTree()`, `hnCommentToItem()` |
| `packages/core/tests/comments.test.ts` | Tests for comment utilities |
| `packages/core/tests/lobsters-story.test.ts` | Tests for `fetchStory()` and tree builder |

### Core — Modified
| File | Change |
|------|--------|
| `packages/core/src/models.ts` | Add `CommentItem` interface |
| `packages/core/src/lobsters.ts` | Add `fetchStory()`, Lobsters comment types, tree builder |
| `packages/core/src/index.ts` | Export `comments.ts` |

### Web — Modified
| File | Change |
|------|--------|
| `components/CommentNode.svelte` | `Comment` → `CommentItem`, add score display, source-aware author |
| `components/CommentTree.svelte` | Remove fetching, accept `comments: CommentItem[]` |
| `routes/item/[id]/+page.svelte` | Source-aware: parse ID prefix, dispatch to HN or Lobsters client |
| `components/StoryCard.svelte` | Internal linking for Lobsters items |
| `routes/api/summarize/+server.ts` | Accept generic item data alongside HN storyId |

---

## Verification

1. `cd packages/core && pnpm test` — comment utility tests pass
2. `cd packages/web && pnpm test` — component tests pass
3. Dev server:
   - HN detail page still works identically (comments load, focus mode, summaries)
   - Lobsters feed → click story → internal detail page with threaded comments
   - Collapse/expand, focus mode, copy work on Lobsters comments
   - AI summary works on Lobsters stories
   - Tags and comment scores display for Lobsters
   - Save to collection works from Lobsters detail page
   - Keyboard shortcuts work on Lobsters detail page
4. `cd packages/web && pnpm build` — production build succeeds
