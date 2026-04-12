# Lobsters Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Lobsters story detail page with reusable threaded comments, matching HN detail page features.

**Architecture:** Introduce a `CommentItem` type that both sources map into with pre-built children trees. Refactor `CommentNode`/`CommentTree` to render `CommentItem` instead of HN-specific `Comment`. Make `/item/[id]` route source-aware by parsing ID prefix (`hn:`, `lo:`). Add `fetchStory()` to `LobstersClient`. Extend summarize endpoint to accept generic item data.

**Tech Stack:** TypeScript, SvelteKit 5, Svelte 5 runes, Vitest

---

### Task 1: Core — CommentItem Type

**Files:**
- Modify: `packages/core/src/models.ts`

- [ ] **Step 1: Add CommentItem interface to models.ts**

Append to end of `packages/core/src/models.ts`:

```typescript
export interface CommentItem {
  id: string
  source: ContentSource
  text: string
  author: string
  timestamp: number
  score?: number
  deleted?: boolean
  dead?: boolean
  children: CommentItem[]
  depth: number
  sourceUrl?: string
}
```

- [ ] **Step 2: Run core tests to verify no regressions**

Run: `cd packages/core && pnpm test`
Expected: All 78 tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/models.ts
git commit -m "feat: add CommentItem type for source-agnostic comments"
```

---

### Task 2: Core — HN Comment Tree Builder

**Files:**
- Create: `packages/core/src/comments.ts`
- Create: `packages/core/tests/comments.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test for hnCommentToItem**

```typescript
// packages/core/tests/comments.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hnCommentToItem, fetchHnCommentTree } from '../src/comments.js'
import type { Comment } from '../src/models.js'
import { HnClient } from '../src/client.js'

function makeComment(id: number, overrides: Partial<Comment> = {}): Comment {
  return {
    id,
    text: `<p>Comment ${id}</p>`,
    by: 'testuser',
    time: 1700000000,
    parent: 1,
    ...overrides,
  }
}

describe('hnCommentToItem', () => {
  it('converts an HN Comment to CommentItem', () => {
    const comment = makeComment(42, { kids: [100, 101] })
    const item = hnCommentToItem(comment, 0)

    expect(item.id).toBe('hn:42')
    expect(item.source).toBe('hackernews')
    expect(item.text).toBe('<p>Comment 42</p>')
    expect(item.author).toBe('testuser')
    expect(item.timestamp).toBe(1700000000)
    expect(item.depth).toBe(0)
    expect(item.children).toEqual([])
    expect(item.score).toBeUndefined()
  })

  it('handles deleted comments', () => {
    const comment = makeComment(42, { deleted: true })
    const item = hnCommentToItem(comment, 1)
    expect(item.deleted).toBe(true)
    expect(item.depth).toBe(1)
  })
})

describe('fetchHnCommentTree', () => {
  let mockClient: { fetchItem: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockClient = { fetchItem: vi.fn() }
  })

  it('fetches and builds comment tree', async () => {
    const parent = makeComment(1, { kids: [2] })
    const child = makeComment(2, { parent: 1 })
    mockClient.fetchItem
      .mockResolvedValueOnce(parent)
      .mockResolvedValueOnce(child)

    const tree = await fetchHnCommentTree(mockClient as unknown as HnClient, [1])
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('hn:1')
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].id).toBe('hn:2')
    expect(tree[0].children[0].depth).toBe(1)
  })

  it('skips deleted and dead comments', async () => {
    mockClient.fetchItem
      .mockResolvedValueOnce(makeComment(1, { deleted: true }))
      .mockResolvedValueOnce(makeComment(2, { dead: true }))
      .mockResolvedValueOnce(makeComment(3))

    const tree = await fetchHnCommentTree(mockClient as unknown as HnClient, [1, 2, 3])
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe('hn:3')
  })

  it('skips null results', async () => {
    mockClient.fetchItem.mockResolvedValueOnce(null)
    const tree = await fetchHnCommentTree(mockClient as unknown as HnClient, [999])
    expect(tree).toHaveLength(0)
  })

  it('respects maxDepth', async () => {
    const c1 = makeComment(1, { kids: [2] })
    const c2 = makeComment(2, { kids: [3], parent: 1 })
    const c3 = makeComment(3, { parent: 2 })
    mockClient.fetchItem
      .mockResolvedValueOnce(c1)
      .mockResolvedValueOnce(c2)

    const tree = await fetchHnCommentTree(mockClient as unknown as HnClient, [1], 0, 1)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].children).toHaveLength(0) // stopped at maxDepth
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --run tests/comments.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement comments.ts**

```typescript
// packages/core/src/comments.ts
import type { Comment, CommentItem } from './models.js'
import { HnClient } from './client.js'

export function hnCommentToItem(comment: Comment, depth: number): CommentItem {
  return {
    id: `hn:${comment.id}`,
    source: 'hackernews',
    text: comment.text,
    author: comment.by,
    timestamp: comment.time,
    deleted: comment.deleted,
    dead: comment.dead,
    children: [],
    depth,
  }
}

export async function fetchHnCommentTree(
  client: HnClient,
  ids: number[],
  depth = 0,
  maxDepth = 10,
): Promise<CommentItem[]> {
  if (!ids.length || depth > maxDepth) return []

  const results = await Promise.all(ids.map((id) => client.fetchItem(id)))
  const items: CommentItem[] = []

  for (const result of results) {
    if (!result || !('parent' in result)) continue
    const comment = result as Comment
    if (comment.deleted || comment.dead) continue

    const item = hnCommentToItem(comment, depth)
    if (comment.kids?.length) {
      item.children = await fetchHnCommentTree(client, comment.kids, depth + 1, maxDepth)
    }
    items.push(item)
  }

  return items
}
```

- [ ] **Step 4: Export from index.ts**

Add to `packages/core/src/index.ts`:
```typescript
export * from './comments.js'
```

- [ ] **Step 5: Run tests**

Run: `cd packages/core && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/comments.ts packages/core/tests/comments.test.ts packages/core/src/index.ts
git commit -m "feat: add HN comment tree builder with CommentItem conversion"
```

---

### Task 3: Core — Lobsters fetchStory + Tree Builder

**Files:**
- Modify: `packages/core/src/lobsters.ts`
- Create: `packages/core/tests/lobsters-story.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/core/tests/lobsters-story.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LobstersClient } from '../src/lobsters.js'

function makeLobstersStoryResponse() {
  return {
    short_id: 'abc123',
    title: 'Test Story',
    url: 'https://example.com',
    score: 42,
    created_at: '2024-01-15T10:30:00.000-06:00',
    submitter_user: 'testuser',
    comment_count: 3,
    comments_url: 'https://lobste.rs/s/abc123/test_story',
    short_id_url: 'https://lobste.rs/s/abc123',
    description: 'A test story',
    tags: ['programming'],
    comments: [
      {
        short_id: 'c1',
        comment: '<p>Top level comment</p>',
        comment_plain: 'Top level comment',
        commenting_user: 'user1',
        created_at: '2024-01-15T11:00:00.000-06:00',
        score: 5,
        depth: 0,
        parent_comment: null,
        is_deleted: false,
        is_moderated: false,
        short_id_url: 'https://lobste.rs/c/c1',
        url: 'https://lobste.rs/c/c1',
      },
      {
        short_id: 'c2',
        comment: '<p>Reply to c1</p>',
        comment_plain: 'Reply to c1',
        commenting_user: 'user2',
        created_at: '2024-01-15T12:00:00.000-06:00',
        score: 3,
        depth: 1,
        parent_comment: 'c1',
        is_deleted: false,
        is_moderated: false,
        short_id_url: 'https://lobste.rs/c/c2',
        url: 'https://lobste.rs/c/c2',
      },
      {
        short_id: 'c3',
        comment: '<p>Another top level</p>',
        comment_plain: 'Another top level',
        commenting_user: 'user3',
        created_at: '2024-01-15T13:00:00.000-06:00',
        score: 1,
        depth: 0,
        parent_comment: null,
        is_deleted: false,
        is_moderated: false,
        short_id_url: 'https://lobste.rs/c/c3',
        url: 'https://lobste.rs/c/c3',
      },
    ],
  }
}

describe('LobstersClient.fetchStory', () => {
  let client: LobstersClient
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    client = new LobstersClient(mockFetch)
  })

  it('fetches story and returns FeedItem + CommentItem tree', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeLobstersStoryResponse()),
    })

    const result = await client.fetchStory('abc123')

    expect(result.story.id).toBe('lo:abc123')
    expect(result.story.source).toBe('lobsters')
    expect(result.story.title).toBe('Test Story')

    expect(result.comments).toHaveLength(2) // 2 top-level
    expect(result.comments[0].id).toBe('lo:c1')
    expect(result.comments[0].author).toBe('user1')
    expect(result.comments[0].score).toBe(5)
    expect(result.comments[0].depth).toBe(0)
    expect(result.comments[0].children).toHaveLength(1)
    expect(result.comments[0].children[0].id).toBe('lo:c2')
    expect(result.comments[0].children[0].depth).toBe(1)

    expect(result.comments[1].id).toBe('lo:c3')
    expect(result.comments[1].children).toHaveLength(0)
  })

  it('calls correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ...makeLobstersStoryResponse(), comments: [] }),
    })

    await client.fetchStory('xyz')
    expect(mockFetch).toHaveBeenCalledWith('https://lobste.rs/s/xyz.json')
  })

  it('skips deleted and moderated comments', async () => {
    const data = makeLobstersStoryResponse()
    data.comments[0].is_deleted = true
    data.comments[1].is_moderated = true
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    })

    const result = await client.fetchStory('abc123')
    expect(result.comments).toHaveLength(1) // only c3 remains
    expect(result.comments[0].id).toBe('lo:c3')
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(client.fetchStory('bad')).rejects.toThrow('Lobsters API error: 404')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test -- --run tests/lobsters-story.test.ts`
Expected: FAIL — fetchStory not defined

- [ ] **Step 3: Implement fetchStory and tree builder in lobsters.ts**

Add these types and methods to `packages/core/src/lobsters.ts`:

After the existing `LobstersStory` interface, add:

```typescript
interface LobstersRawComment {
  short_id: string
  comment: string
  comment_plain: string
  commenting_user: string
  created_at: string
  score: number
  depth: number
  parent_comment: string | null
  is_deleted: boolean
  is_moderated: boolean
  short_id_url: string
  url: string
}

interface LobstersStoryResponse extends LobstersStory {
  comments: LobstersRawComment[]
}
```

Add `fetchStory` method to `LobstersClient`:

```typescript
async fetchStory(shortId: string): Promise<{ story: FeedItem; comments: CommentItem[] }> {
  const res = await this.fetch(`${this.baseUrl}/s/${shortId}.json`)
  if (!res.ok) throw new Error(`Lobsters API error: ${res.status}`)

  const data: LobstersStoryResponse = await res.json()
  return {
    story: lobstersToFeedItem(data),
    comments: buildLobstersCommentTree(data.comments),
  }
}
```

Add the tree builder function (module-level, after `lobstersToFeedItem`):

```typescript
function buildLobstersCommentTree(flatComments: LobstersRawComment[]): CommentItem[] {
  const roots: CommentItem[] = []
  const map = new Map<string, CommentItem>()

  for (const raw of flatComments) {
    if (raw.is_deleted || raw.is_moderated) continue

    const item: CommentItem = {
      id: `lo:${raw.short_id}`,
      source: 'lobsters',
      text: raw.comment,
      author: raw.commenting_user,
      timestamp: Math.floor(new Date(raw.created_at).getTime() / 1000),
      score: raw.score,
      children: [],
      depth: raw.depth,
      sourceUrl: raw.short_id_url,
    }

    map.set(raw.short_id, item)

    if (raw.parent_comment && map.has(raw.parent_comment)) {
      map.get(raw.parent_comment)!.children.push(item)
    } else {
      roots.push(item)
    }
  }

  return roots
}
```

Update the import at top of lobsters.ts to include `CommentItem`:

```typescript
import type { FeedItem, CommentItem } from './models.js'
```

- [ ] **Step 4: Run tests**

Run: `cd packages/core && pnpm test`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/lobsters.ts packages/core/tests/lobsters-story.test.ts
git commit -m "feat: add Lobsters fetchStory with comment tree builder"
```

---

### Task 4: Web — Refactor CommentNode to CommentItem

**Files:**
- Modify: `packages/web/src/components/CommentNode.svelte`

- [ ] **Step 1: Refactor CommentNode props and rendering**

Change the script section:

```svelte
<script lang="ts">
  import type { CommentItem } from '@omnifeed/core'
  import { timeAgo } from '$lib/time'
  import CommentTree from './CommentTree.svelte'

  let {
    comment,
    depth = 0,
    focusPath = [],
    onfocus,
  }: {
    comment: CommentItem
    depth?: number
    focusPath?: string[]
    onfocus?: (id: string) => void
  } = $props()

  let collapsed = $state(false)
  let isFocused = $derived(focusPath.includes(comment.id))
  let copied = $state(false)
  let isHn = $derived(comment.source === 'hackernews')

  function stripHtml(html: string): string {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent ?? ''
  }

  async function copyComment() {
    await navigator.clipboard.writeText(stripHtml(comment.text))
    copied = true
    setTimeout(() => copied = false, 1500)
  }
</script>
```

Update template — change field names and add score display:

```svelte
{#if !comment.deleted && !comment.dead}
  <div class="comment-node" class:focused={isFocused}>
    {#if depth > 0}
      <div class="indent-guide"></div>
    {/if}
    <div class="comment-content">
      <div class="comment-header">
        <button class="collapse-toggle" onclick={() => (collapsed = !collapsed)}>
          {collapsed ? '[+]' : '[-]'}
        </button>
        {#if isHn}
          <a href="/user/{comment.author}" class="author">{comment.author}</a>
        {:else}
          <span class="author">{comment.author}</span>
        {/if}
        <span class="time">{timeAgo(comment.timestamp)}</span>
        {#if comment.score !== undefined}
          <span class="score">{comment.score} pts</span>
        {/if}
        <button class="copy-btn" onclick={copyComment} title="Copy comment">
          {copied ? '✓' : '⧉'}
        </button>
        {#if onfocus && comment.children.length > 0}
          <button class="focus-btn" onclick={() => onfocus(comment.id)} title="Focus thread">
            [f]
          </button>
        {/if}
      </div>
      {#if !collapsed}
        <div class="comment-body">{@html comment.text}</div>
        {#if comment.children.length > 0}
          <CommentTree
            comments={comment.children}
            depth={depth + 1}
            {focusPath}
            {onfocus}
          />
        {/if}
      {:else}
        <span class="collapsed-hint">
          {comment.children.length} replies
        </span>
      {/if}
    </div>
  </div>
{/if}
```

Add `.score` style alongside existing styles:

```css
.score {
  color: var(--color-text-faint);
  font-size: 0.8rem;
}
```

Keep ALL existing styles unchanged.

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/CommentNode.svelte
git commit -m "refactor: CommentNode renders CommentItem with source-aware fields"
```

---

### Task 5: Web — Refactor CommentTree to Pre-built Tree

**Files:**
- Modify: `packages/web/src/components/CommentTree.svelte`

- [ ] **Step 1: Rewrite CommentTree to accept CommentItem[]**

Replace entire file:

```svelte
<script lang="ts">
  import type { CommentItem } from '@omnifeed/core'
  import CommentNode from './CommentNode.svelte'

  let {
    comments,
    depth = 0,
    focusPath = [],
    onfocus,
  }: {
    comments: CommentItem[]
    depth?: number
    focusPath?: string[]
    onfocus?: (id: string) => void
  } = $props()
</script>

<div class="comment-tree">
  {#each comments as comment (comment.id)}
    <CommentNode
      {comment}
      {depth}
      {focusPath}
      {onfocus}
    />
  {/each}
</div>

<style>
  .comment-tree {
    display: flex;
    flex-direction: column;
  }
</style>
```

No more fetching, no more `HnClient` import, no more loading state. The component just renders what it's given. Loading state is managed by the page.

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/CommentTree.svelte
git commit -m "refactor: CommentTree renders pre-built CommentItem array, no fetching"
```

---

### Task 6: Web — Source-Aware Item Detail Page

This is the largest task. The `/item/[id]` route becomes source-aware.

**Files:**
- Modify: `packages/web/src/routes/item/[id]/+page.svelte`

- [ ] **Step 1: Rewrite the page script for source-awareness**

The page now:
1. Parses the ID prefix to determine source (`hn:`, `lo:`, or bare number = HN)
2. Dispatches to the right client for fetching
3. Builds `CommentItem[]` tree before rendering
4. Uses the same template for both sources (with minor conditional differences)

Replace the `<script>` block:

```svelte
<script lang="ts">
  import { page } from '$app/state'
  import {
    HnClient, LobstersClient,
    type Story, type FeedItem, type CommentItem, type ContentSource,
    SOURCES,
  } from '@omnifeed/core'
  import { fetchHnCommentTree } from '@omnifeed/core'
  import { timeAgo, domainFrom } from '$lib/time'
  import CommentTree from '../../../components/CommentTree.svelte'
  import SaveButton from '../../../components/SaveButton.svelte'
  import { setRefreshHandler } from '$lib/feed.svelte'
  import { marked } from 'marked'
  import { getSummary, saveSummary, clearSummary, isExpanded, setExpanded } from '$lib/summaries.svelte'
  import { getSettings } from '$lib/settings.svelte'

  const hnClient = new HnClient()
  const lobstersClient = new LobstersClient(undefined, '/api/lobsters?path=')

  // Parsed from URL param
  let rawId = $derived(page.params.id)
  let source = $derived<ContentSource>(
    rawId.startsWith('lo:') ? 'lobsters' :
    rawId.startsWith('dev:') ? 'devto' :
    'hackernews'
  )
  let sourceId = $derived(
    rawId.startsWith('lo:') ? rawId.slice(3) :
    rawId.startsWith('hn:') ? rawId.slice(3) :
    rawId.startsWith('dev:') ? rawId.slice(4) :
    rawId
  )
  let itemId = $derived(
    source === 'hackernews' ? `hn:${sourceId}` :
    source === 'lobsters' ? `lo:${sourceId}` :
    `dev:${sourceId}`
  )

  let title = $state('')
  let url = $state<string | undefined>(undefined)
  let bodyText = $state<string | undefined>(undefined)
  let score = $state(0)
  let author = $state('')
  let timestamp = $state(0)
  let commentCount = $state(0)
  let sourceUrl = $state('')
  let tags = $state<string[]>([])

  let comments = $state<CommentItem[]>([])
  let loading = $state(true)
  let flagged = $state(false)
  let refreshKey = $state(0)

  let domain = $derived(domainFrom(url))
  let sourceConfig = $derived(SOURCES.find(s => s.id === source))

  // Focus mode
  let focusStack = $state<string[]>([])
  let displayedComments = $derived<CommentItem[]>(() => {
    if (focusStack.length === 0) return comments
    const focusedId = focusStack[focusStack.length - 1]
    function findComment(items: CommentItem[]): CommentItem | null {
      for (const c of items) {
        if (c.id === focusedId) return c
        const found = findComment(c.children)
        if (found) return found
      }
      return null
    }
    const focused = findComment(comments)
    return focused ? [focused] : comments
  })

  $effect(() => {
    loadItem(source, sourceId)
  })

  $effect(() => {
    setRefreshHandler(() => {
      loadItem(source, sourceId)
      refreshKey++
    })
    return () => setRefreshHandler(null)
  })

  async function loadItem(src: ContentSource, id: string) {
    loading = true
    flagged = false
    focusStack = []
    comments = []

    try {
      if (src === 'hackernews') {
        await loadHnItem(Number(id))
      } else if (src === 'lobsters') {
        await loadLobstersItem(id)
      }
    } catch {
      flagged = true
    }
    loading = false
  }

  async function loadHnItem(id: number) {
    const item = await hnClient.fetchItem(id)
    if (!item || !('title' in item)) {
      flagged = true
      return
    }
    const story = item as Story
    title = story.title
    url = story.url
    bodyText = story.text
    score = story.score
    author = story.by
    timestamp = story.time
    commentCount = story.descendants ?? 0
    sourceUrl = `https://news.ycombinator.com/item?id=${id}`
    tags = []

    if (story.kids?.length) {
      comments = await fetchHnCommentTree(hnClient, story.kids)
    }
  }

  async function loadLobstersItem(shortId: string) {
    const result = await lobstersClient.fetchStory(shortId)
    title = result.story.title
    url = result.story.url
    bodyText = result.story.text
    score = result.story.score
    author = result.story.author
    timestamp = result.story.timestamp
    commentCount = result.story.commentCount
    sourceUrl = result.story.sourceUrl
    tags = result.story.tags ?? []
    comments = result.comments
  }

  function focusComment(commentId: string) {
    focusStack = [...focusStack, commentId]
  }

  function unfocus() {
    focusStack = focusStack.slice(0, -1)
  }

  // --- Summary system (unchanged logic, source-generic) ---
  const appSettings = getSettings()

  let summaryText = $state('')
  let summaryExpanded = $state(false)
  let summaryLoading = $state(false)
  let summaryError = $state('')
  let hasSummary = $derived(!!summaryText || summaryLoading || !!summaryError)

  $effect(() => {
    if (title) {
      const cached = getSummary(itemId)
      if (cached) {
        summaryText = cached
        summaryExpanded = isExpanded(itemId)
      } else {
        summaryText = ''
        summaryExpanded = false
      }
      summaryError = ''
      summaryLoading = false
    }
  })

  let summaryCopied = $state(false)
  let postCopied = $state(false)

  async function copySummary() {
    if (!summaryText) return
    await navigator.clipboard.writeText(summaryText)
    summaryCopied = true
    setTimeout(() => summaryCopied = false, 1500)
  }

  function stripHtml(html: string): string {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent ?? ''
  }

  async function copyPost() {
    let content = ''
    if (bodyText) content += stripHtml(bodyText)
    if (url) {
      if (content) content += '\n\n'
      content += url
    }
    if (!content) return
    await navigator.clipboard.writeText(content)
    postCopied = true
    setTimeout(() => postCopied = false, 1500)
  }

  function toggleSummary() {
    if (!summaryText && !summaryLoading) {
      fetchSummary()
      return
    }
    summaryExpanded = !summaryExpanded
    setExpanded(itemId, summaryExpanded)
  }

  async function fetchSummary() {
    summaryExpanded = true
    summaryText = ''
    summaryError = ''
    summaryLoading = true

    try {
      const body: Record<string, unknown> = { model: appSettings.value.model }
      if (source === 'hackernews') {
        body.storyId = Number(sourceId)
      } else {
        body.title = title
        body.url = url
        body.text = bodyText
        body.comments = comments.slice(0, 30).map(c => ({
          author: c.author,
          text: stripHtml(c.text),
        }))
      }

      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const text = await res.text()
      if (!res.ok) {
        summaryError = text
      } else {
        summaryText = text
        saveSummary(itemId, text)
        setExpanded(itemId, true)
      }
    } catch {
      summaryError = 'Failed to generate summary.'
    }
    summaryLoading = false
  }
</script>
```

- [ ] **Step 2: Update the template**

Replace the template (everything between `</script>` and `<style>`):

```svelte
{#if loading}
  <p class="loading">Loading...</p>
{:else if flagged}
  <p class="flagged">This item has been flagged or removed.</p>
{:else}
  <header class="story-header">
    <div class="story-text">
      <h1 class="story-title">
        {#if url}
          <a href={url} target="_blank" rel="noopener">{title}</a>
        {:else}
          {title}
        {/if}
      </h1>
      <div class="story-meta">
        {score} points |
        {#if source === 'hackernews'}
          <a href="/user/{author}" class="author">{author}</a>
        {:else}
          <span class="author">{author}</span>
        {/if}
        | {timeAgo(timestamp)} | {commentCount} comments
        {#if domain}
          | {domain}
        {/if}
        {#if tags.length > 0}
          | <span class="tags">{tags.join(', ')}</span>
        {/if}
      </div>
    </div>
    <div class="header-actions">
      <button class="ai-btn" onclick={toggleSummary} title="AI summary" disabled={summaryLoading}>✦</button>
      <SaveButton {itemId} />
      {#if url}
        <a href={url} target="_blank" rel="noopener" class="open-link" title="Open link">↗</a>
      {/if}
      <a href={sourceUrl} target="_blank" rel="noopener" class="open-link" title="View on {sourceConfig?.name ?? source}">↗</a>
    </div>
  </header>

  {#if hasSummary}
    <div class="summary-panel">
      <button class="summary-header" onclick={() => { summaryExpanded = !summaryExpanded; setExpanded(itemId, summaryExpanded) }}>
        <span class="summary-label">AI Summary {summaryExpanded ? '▾' : '▸'}</span>
        <div class="summary-actions" onclick={(e) => e.stopPropagation()}>
          {#if summaryText && !summaryLoading}
            <button class="summary-copy" onclick={copySummary}>{summaryCopied ? 'Copied!' : 'Copy'}</button>
            <button class="summary-regen" onclick={fetchSummary}>Regenerate</button>
            <button class="summary-dismiss" onclick={() => { clearSummary(itemId); summaryText = ''; summaryError = ''; summaryExpanded = false }}>Dismiss</button>
          {/if}
        </div>
      </button>
      {#if summaryLoading}
        <div class="summary-loading">
          <span class="summary-spinner">✦</span>
        </div>
      {/if}
      {#if summaryExpanded}
        <div class="summary-body">
          {#if summaryError}
            <p class="summary-error">{summaryError}</p>
          {:else if summaryText}
            {@html marked(summaryText)}
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if bodyText}
    <div class="story-body-wrapper">
      <div class="story-body">{@html bodyText}</div>
      <button class="post-copy-btn" onclick={copyPost} title="Copy post text and link">
        {postCopied ? '✓' : '⧉'}
      </button>
    </div>
  {/if}

  {#if focusStack.length > 0}
    <div class="focus-breadcrumb">
      <button onclick={unfocus}>&larr; Back</button>
      <span class="focus-label">Focused ({focusStack.length} deep)</span>
    </div>
  {/if}

  <section class="comments-section">
    {#if displayedComments().length > 0}
      {#key refreshKey}
        <CommentTree
          comments={displayedComments()}
          focusPath={focusStack}
          onfocus={focusComment}
        />
      {/key}
    {:else}
      <p class="no-comments">No comments.</p>
    {/if}
  </section>
{/if}
```

- [ ] **Step 3: Add tags style**

Add to the `<style>` block:

```css
.tags {
  color: var(--color-text-faint);
  font-size: 0.75rem;
}
```

Keep ALL existing styles unchanged.

- [ ] **Step 4: Run web tests**

Run: `cd packages/web && pnpm test`
Expected: All pass (or fix any failures from the refactor)

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/routes/item/\\[id\\]/+page.svelte
git commit -m "feat: source-aware item detail page supporting HN and Lobsters"
```

---

### Task 7: Web — StoryCard Internal Linking for Lobsters

**Files:**
- Modify: `packages/web/src/components/StoryCard.svelte`

- [ ] **Step 1: Update detail link logic**

In StoryCard.svelte, change these two lines:

```typescript
// Old:
let isHn = $derived(item.source === 'hackernews')
let detailHref = $derived(isHn ? `/item/${item.originalId}` : item.sourceUrl)
```

```typescript
// New:
let hasDetailPage = $derived(item.source === 'hackernews' || item.source === 'lobsters')
let detailHref = $derived(hasDetailPage ? `/item/${item.id}` : item.sourceUrl)
```

Then update all references from `isHn` to `hasDetailPage` for navigation logic (the card click handler, the `target` attribute). Keep `isHn` for HN-specific features (AI summary button on feed cards, user profile links).

Specifically, in the `<a>` onclick handler:
```svelte
onclick={(e: MouseEvent) => {
  markRead(item.id)
  if (!hasDetailPage) {
    e.preventDefault()
    window.open(detailHref, '_blank', 'noopener')
  }
}}
```

Re-add the `isHn` derived for use in HN-specific conditionals (AI summary, user link):
```typescript
let isHn = $derived(item.source === 'hackernews')
```

- [ ] **Step 2: Run tests**

Run: `cd packages/web && pnpm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/StoryCard.svelte
git commit -m "feat: StoryCard navigates to internal detail page for Lobsters items"
```

---

### Task 8: Web — Summarize Endpoint Generic Support

**Files:**
- Modify: `packages/web/src/routes/api/summarize/+server.ts`

- [ ] **Step 1: Add generic item support to POST handler**

The endpoint currently accepts `{ storyId, model }` and fetches the HN story. Add support for a generic payload where the caller passes the data directly:

```typescript
{ title, url?, text?, comments?: { author, text }[], model }
```

In the `POST` handler, after parsing the body, add a branch:

```typescript
// After the existing body parsing
const { storyId, model, title: itemTitle, url: itemUrl, text: itemText, comments: itemComments } = body as any

// Generic mode: caller passes data directly
if (itemTitle && !storyId) {
  const articleText = itemUrl ? await fetchArticleText(itemUrl, skFetch) : ''

  const prompt = buildGenericPrompt(
    itemTitle,
    itemText as string | undefined,
    articleText,
    (itemComments as { author: string; text: string }[]) ?? [],
  )

  try {
    const result = await runClaudeWithRetry(prompt, model)
    return new Response(result, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(message, { status: 502 })
  }
}

// Existing HN flow continues below...
```

Add the `buildGenericPrompt` function alongside the existing `buildPrompt`:

```typescript
function buildGenericPrompt(
  title: string,
  text: string | undefined,
  articleText: string,
  comments: { author: string; text: string }[],
): string {
  let context = `Analyze the following post. Provide a concise summary covering:
1. What the post/article is about (2-3 sentences)
2. Key takeaways or interesting points
3. Notable themes or perspectives from the discussion (if comments are present)

Be direct and informative. Use markdown formatting.

# "${title}"\n`

  if (text) {
    context += `\n## Post text\n${text}\n`
  }

  if (articleText) {
    context += `\n## Linked article content\n${articleText}\n`
  }

  if (comments.length > 0) {
    context += `\n## Discussion (top comments)\n`
    for (const c of comments) {
      context += `- ${c.author}: ${c.text}\n`
    }
  }

  return context
}
```

- [ ] **Step 2: Run all tests**

Run: `cd packages/core && pnpm test && cd ../web && pnpm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/routes/api/summarize/+server.ts
git commit -m "feat: summarize endpoint accepts generic item data for non-HN sources"
```

---

### Task 9: Integration Testing & Polish

- [ ] **Step 1: Run all tests**

Run: `cd packages/core && pnpm test && cd ../web && pnpm test`
Fix any failures.

- [ ] **Step 2: Start dev server and test HN detail page (regression)**

Run: `cd packages/web && pnpm dev`

Test:
- Navigate to HN feed, click a story → detail page loads
- Comments render with threading, collapse/expand works
- Focus mode works (click [f], breadcrumb shows, Back works)
- AI summary generates and caches
- Save to collection works

- [ ] **Step 3: Test Lobsters detail page**

Test:
- Switch to Lobsters source in navbar
- Click a story → internal detail page loads (not external link)
- URL shows `/item/lo:xxxxx`
- Story header shows title, score, author, time, tags
- Comments render with threading and scores
- Collapse/expand works
- Focus mode works
- AI summary generates (via generic endpoint)
- Copy comment works
- Save to collection works
- External link (↗) opens Lobsters post in new tab

- [ ] **Step 4: Test keyboard navigation**

Test:
- From Lobsters feed, press `o` to open selected story → opens detail page
- Press `c` on a Lobsters item → should do nothing (only HN has `/user/` pages)

Wait — `c` in keyboard.svelte.ts currently only works for `hn:` prefixed IDs. Lobsters items have `lo:` prefix, so pressing `c` should also navigate to the detail page. Fix this in `keyboard.svelte.ts`:

```typescript
case 'c': {
  e.preventDefault()
  const id = state.storyIds[state.selectedIndex]
  if (id?.startsWith('hn:') || id?.startsWith('lo:')) {
    goto(`/item/${id}`)
  }
  break
}
```

- [ ] **Step 5: Run production build**

Run: `cd packages/web && pnpm build`
Expected: Build succeeds

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for Lobsters detail page"
```

---

## Notes

- The HN item detail page now pre-fetches ALL comments before rendering (via `fetchHnCommentTree`). This changes from the previous progressive loading (level-by-level) to a full tree load. Performance is similar since comments were already fetched in parallel, but the UX shows a single loading state instead of progressive reveal.
- Focus mode uses string IDs (`"hn:123"`, `"lo:abc"`) and searches the pre-built tree recursively.
- The `displayedComments` derived uses a function return (`$derived(() => ...)`) because it needs to search the comment tree when in focus mode.
- Lobsters comments have `score` displayed as "N pts" in the comment header. HN comments don't show score (HN doesn't expose it).
- The summarize endpoint now has two modes: HN mode (fetches story/comments by ID) and generic mode (receives data directly). Both produce the same Claude prompt format.
