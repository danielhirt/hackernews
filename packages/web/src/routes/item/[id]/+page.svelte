<script lang="ts">
  import { page } from '$app/state'
  import {
    HnClient, LobstersClient, DevtoClient,
    type Story, type FeedItem, type CommentItem, type ContentSource,
    SOURCES, SOURCE_ID, parseItemId, buildItemId,
  } from '@omnifeed/core'
  import { fetchHnCommentBatch, fetchHnCommentChildren } from '@omnifeed/core'
  import { timeAgo, domainFrom } from '$lib/time'
  import CommentTree from '../../../components/CommentTree.svelte'
  import SaveButton from '../../../components/SaveButton.svelte'
  import { setRefreshHandler, getFeedState } from '$lib/feed.svelte'
  import { marked } from 'marked'
  import { getSummary, saveSummary, clearSummary, isExpanded, setExpanded } from '$lib/summaries.svelte'
  import { getSettings } from '$lib/settings.svelte'
  import { sortCommentTree, type CommentSortMode } from '$lib/sort-filter'
  import { sanitizeHtml } from '$lib/sanitize'
  import { showToast, updateToast } from '$lib/toast.svelte'

  const hnClient = new HnClient()
  const lobstersClient = new LobstersClient(undefined, '/api/lobsters?path=')
  const devtoClient = new DevtoClient()
  const feed = getFeedState()

  let rawId = $derived(page.params.id ?? '')
  let parsed = $derived(parseItemId(rawId))
  let source = $derived(parsed.source)
  let sourceId = $derived(parsed.id)
  let itemId = $derived(buildItemId(source, sourceId))

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
  let storyLoading = $state(true)
  let commentsLoading = $state(false)
  let flagged = $state(false)
  let refreshKey = $state(0)
  let refreshingComments = $state(false)

  // HN-only: unfetched root comment IDs for "Load more" pagination
  const ROOT_CHUNK = 30
  let pendingRootIds = $state<number[]>([])
  let loadingMoreRoots = $state(false)

  let domain = $derived(domainFrom(url))
  let sourceConfig = $derived(SOURCES.find(s => s.id === source))
  let isHn = $derived(source === SOURCE_ID.HN)

  // Focus mode
  let focusStack = $state<string[]>([])

  // Comment controls
  let commentSort = $state<CommentSortMode>('default')
  let collapseAll = $state(false)

  function findComment(items: CommentItem[], targetId: string): CommentItem | null {
    for (const c of items) {
      if (c.id === targetId) return c
      const found = findComment(c.children, targetId)
      if (found) return found
    }
    return null
  }

  function countComments(items: CommentItem[]): number {
    let count = 0
    for (const c of items) {
      count += 1 + countComments(c.children)
    }
    return count
  }

  let displayedComments = $derived.by(() => {
    let result = comments
    if (focusStack.length > 0) {
      const focusedId = focusStack[focusStack.length - 1]
      const focused = findComment(comments, focusedId)
      result = focused ? [focused] : comments
    }
    return sortCommentTree(result, commentSort)
  })

  let displayedCount = $derived(focusStack.length > 0 ? countComments(displayedComments) : commentCount)

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
    storyLoading = true
    commentsLoading = false
    flagged = false
    focusStack = []
    comments = []
    pendingRootIds = []

    try {
      if (src === SOURCE_ID.HN) {
        await loadHnItem(Number(id))
      } else if (src === SOURCE_ID.LOBSTERS) {
        await loadLobstersItem(id)
      } else if (src === SOURCE_ID.DEVTO) {
        await loadDevtoItem(Number(id))
      }
    } catch {
      flagged = true
      storyLoading = false
      commentsLoading = false
    }
  }

  async function loadHnItem(id: number) {
    const item = await hnClient.fetchItem(id)
    if (!item || !('title' in item)) {
      flagged = true
      storyLoading = false
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
    storyLoading = false

    if (story.kids?.length) {
      commentsLoading = true
      try {
        const allKids = story.kids
        const initial = allKids.slice(0, ROOT_CHUNK)
        pendingRootIds = allKids.slice(ROOT_CHUNK)
        comments = await fetchHnCommentBatch(hnClient, initial)
      } finally {
        commentsLoading = false
      }
    } else {
      pendingRootIds = []
    }
  }

  async function loadMoreRoots() {
    if (loadingMoreRoots || pendingRootIds.length === 0) return
    loadingMoreRoots = true
    try {
      const next = pendingRootIds.slice(0, ROOT_CHUNK)
      const remaining = pendingRootIds.slice(ROOT_CHUNK)
      const batch = await fetchHnCommentBatch(hnClient, next)
      comments = [...comments, ...batch]
      pendingRootIds = remaining
    } finally {
      loadingMoreRoots = false
    }
  }

  // Lazy-fetch a comment's children when expanded. Mutates the tree in place
  // by replacing the matching CommentItem and reassigning `comments` for
  // reactivity. Returns false if nothing was fetched (no pendingKidIds, or HN
  // is not the source).
  async function loadChildren(targetId: string): Promise<void> {
    const node = findComment(comments, targetId)
    if (!node || !node.pendingKidIds?.length) return
    const kidIds = node.pendingKidIds
    node.pendingKidIds = undefined  // optimistic clear so user can't double-click
    try {
      const kids = await fetchHnCommentChildren(hnClient, node.depth, kidIds)
      node.children = kids
      // Trigger reactivity: reassign root array
      comments = [...comments]
    } catch {
      // Restore on failure
      node.pendingKidIds = kidIds
      comments = [...comments]
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
    storyLoading = false
    comments = result.comments
  }

  async function loadDevtoItem(id: number) {
    // Race the two requests independently so the article paints as soon as it lands,
    // even if comments take longer.
    const articlePromise = devtoClient.fetchArticle(id)
    commentsLoading = true
    const commentsPromise = devtoClient.fetchComments(id).finally(() => {
      commentsLoading = false
    })

    const article = await articlePromise
    title = article.title
    url = article.url
    bodyText = article.text
    score = article.score
    author = article.author
    timestamp = article.timestamp
    commentCount = article.commentCount
    sourceUrl = article.sourceUrl
    tags = article.tags ?? []
    storyLoading = false

    comments = await commentsPromise
  }

  async function refreshComments() {
    if (refreshingComments) return
    refreshingComments = true
    try {
      if (source === SOURCE_ID.HN) {
        const item = await hnClient.fetchItem(Number(sourceId))
        if (item && 'kids' in item && (item as Story).kids?.length) {
          const allKids = (item as Story).kids!
          const initial = allKids.slice(0, ROOT_CHUNK)
          pendingRootIds = allKids.slice(ROOT_CHUNK)
          comments = await fetchHnCommentBatch(hnClient, initial)
          commentCount = (item as Story).descendants ?? 0
        }
      } else if (source === SOURCE_ID.LOBSTERS) {
        const result = await lobstersClient.fetchStory(sourceId)
        comments = result.comments
        commentCount = result.story.commentCount
      } else if (source === SOURCE_ID.DEVTO) {
        const [articleComments, article] = await Promise.all([
          devtoClient.fetchComments(Number(sourceId)),
          devtoClient.fetchArticle(Number(sourceId)),
        ])
        comments = articleComments
        commentCount = article.commentCount
      }
      refreshKey++
    } catch (err) {
      console.error('Failed to refresh comments:', err)
    }
    refreshingComments = false
  }

  function focusComment(commentId: string) {
    focusStack = [...focusStack, commentId]
    collapseAll = false
    refreshKey++
  }

  function unfocus() {
    focusStack = focusStack.slice(0, -1)
    collapseAll = false
    refreshKey++
  }

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

  function buildSummarizeBody(): Record<string, unknown> {
    const body: Record<string, unknown> = { model: appSettings.value.model }
    if (source === SOURCE_ID.HN) {
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
    return body
  }

  async function fetchSummary() {
    summaryExpanded = true
    summaryText = ''
    summaryError = ''
    summaryLoading = true

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSummarizeBody()),
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

  async function saveToObsidian() {
    const toastId = showToast('Saving to Obsidian...')

    try {
      let summary = getSummary(itemId)
      if (!summary) {
        const sumRes = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildSummarizeBody()),
        })

        if (!sumRes.ok) {
          const errText = await sumRes.text()
          updateToast(toastId, `Summary failed: ${errText}`, 'error')
          return
        }

        summary = await sumRes.text()
        saveSummary(itemId, summary)
        summaryText = summary
        summaryExpanded = true
        setExpanded(itemId, true)
      }

      // Step 2: Save to Obsidian
      updateToast(toastId, 'Writing to Obsidian...')

      const saveRes = await fetch('/api/obsidian-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          url,
          bodyText: url ? undefined : bodyText,
          summary,
          source,
          author,
          tags,
        }),
      })

      const result = await saveRes.json()
      if (saveRes.ok && result.success) {
        updateToast(toastId, 'Saved to Obsidian', 'success')
      } else {
        updateToast(toastId, result.message ?? 'Failed to save', 'error')
      }
    } catch {
      updateToast(toastId, 'Failed to save to Obsidian', 'error')
    }
  }
</script>

{#if storyLoading}
  <p class="loading">Loading...</p>
{:else if flagged}
  <p class="flagged">This item has been flagged or removed.</p>
{:else}
  <button class="back-link" onclick={() => history.back()}>← Back</button>
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
        {#if isHn}
          <a href="/user/{author}" class="author">{author}</a>
        {:else if source === SOURCE_ID.LOBSTERS}
          <a href="/user/{author}?source=lobsters" class="author">{author}</a>
        {:else if source === SOURCE_ID.DEVTO}
          <a href="/user/{author}?source=devto" class="author">{author}</a>
        {:else}
          <span class="author">{author}</span>
        {/if}
        | {timeAgo(timestamp)} | {commentCount} comments
        {#if domain}
          | {domain}
        {/if}
        {#if tags.length > 0}
          | {#each tags as tag}<a
              class="tag-pill"
              href="/?source={source}&tag={tag}"
            >{tag}</a>{/each}
        {/if}
        | <a class="source-link" href={sourceUrl} target="_blank" rel="noopener">View on {sourceConfig?.shortName ?? source} ↗</a>
      </div>
    </div>
    <div class="header-actions">
      <button class="ai-btn" onclick={toggleSummary} title="AI summary" disabled={summaryLoading}>✦</button>
      <SaveButton {itemId} onobsidian={saveToObsidian} />
      {#if url}
        <a href={url} target="_blank" rel="noopener" class="open-link" title="Open link">↗</a>
      {/if}
    </div>
  </header>

  {#if hasSummary}
    <div class="summary-panel">
      <div class="summary-header" role="button" tabindex="0" onclick={() => { summaryExpanded = !summaryExpanded; setExpanded(itemId, summaryExpanded) }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); summaryExpanded = !summaryExpanded; setExpanded(itemId, summaryExpanded) } }}>
        <span class="summary-label-group">
          <span class="summary-label">AI Summary</span>
          <span class="summary-toggle-icon">{summaryExpanded ? '▾' : '▸'}</span>
        </span>
        <div class="summary-actions">
          {#if summaryText && !summaryLoading}
            <button class="action-icon" onclick={(e) => { e.stopPropagation(); copySummary() }} title="Copy">{summaryCopied ? '✓' : '⧉'}</button>
            <button class="action-icon" onclick={(e) => { e.stopPropagation(); fetchSummary() }} title="Regenerate">↻</button>
            <button class="action-icon action-danger" onclick={(e) => { e.stopPropagation(); clearSummary(itemId); summaryText = ''; summaryError = ''; summaryExpanded = false }} title="Dismiss">✕</button>
          {/if}
        </div>
      </div>
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
            {@html sanitizeHtml(marked(summaryText) as string)}
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if bodyText}
    <div class="story-body-wrapper">
      <div class="story-body">{@html sanitizeHtml(bodyText)}</div>
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
    {#if comments.length > 0}
      <div class="comment-controls">
        <div class="controls-left">
          <span class="comments-label">Comments</span>
          <span class="comments-count">{displayedCount}</span>
        </div>
        <div class="controls-right">
          <button class="control-btn" class:active={commentSort === 'default'} onclick={() => commentSort = 'default'}>Default</button>
          <button class="control-btn" class:active={commentSort === 'newest'} onclick={() => commentSort = 'newest'}>Newest</button>
          <button class="control-btn" class:active={commentSort === 'oldest'} onclick={() => commentSort = 'oldest'}>Oldest</button>
          <span class="controls-sep">|</span>
          <button class="control-btn" onclick={() => { collapseAll = !collapseAll; refreshKey++ }}>
            {collapseAll ? 'Expand all' : 'Collapse all'}
          </button>
          <span class="controls-sep">|</span>
          <button class="control-icon" onclick={refreshComments} title="Refresh comments" disabled={refreshingComments}>
            ↻
          </button>
        </div>
      </div>
    {/if}
    {#if commentsLoading && comments.length === 0}
      <p class="comments-loading">Loading comments...</p>
    {:else if displayedComments.length > 0}
      {#key refreshKey}
        <CommentTree
          comments={displayedComments}
          focusPath={focusStack}
          onfocus={focusComment}
          onloadchildren={isHn ? loadChildren : undefined}
          defaultCollapsed={collapseAll}
        />
      {/key}
      {#if isHn && pendingRootIds.length > 0 && focusStack.length === 0}
        <div class="load-more-wrap">
          <button class="load-more-btn" onclick={loadMoreRoots} disabled={loadingMoreRoots}>
            {loadingMoreRoots ? 'Loading...' : `Load ${Math.min(ROOT_CHUNK, pendingRootIds.length)} more comments (${pendingRootIds.length} remaining)`}
          </button>
        </div>
      {/if}
    {:else}
      <p class="no-comments">No comments.</p>
    {/if}
  </section>
{/if}

<style>
  .back-link {
    display: inline-block;
    font-size: 0.8rem;
    color: var(--color-text-faint);
    text-decoration: none;
    margin-bottom: 8px;
  }

  .back-link:hover {
    color: var(--color-accent);
  }

  .loading {
    color: var(--color-text-muted);
    padding: 16px 0;
  }

  .story-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 12px;
  }

  .story-text {
    min-width: 0;
  }

  .story-title {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.35;
    margin-bottom: 2px;
  }

  .story-title a {
    color: var(--color-text);
  }

  .story-title a:hover {
    color: var(--color-accent);
  }

  .story-meta {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .story-meta .author {
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .story-meta .author:hover {
    color: var(--color-accent);
  }

  .source-link {
    color: var(--color-text-faint);
    text-decoration: none;
  }

  .source-link:hover {
    color: var(--color-accent);
  }

  .story-body-wrapper {
    position: relative;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 12px;
  }

  .post-copy-btn {
    position: absolute;
    top: 0;
    right: 0;
    font-size: 0.95rem;
    color: var(--color-text-faint);
    opacity: 0;
    transition: opacity 0.15s;
    padding: 2px;
  }

  .story-body-wrapper:hover .post-copy-btn {
    opacity: 1;
  }

  .post-copy-btn:hover {
    color: var(--color-accent);
  }

  .story-body {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--color-text);
    overflow-wrap: break-word;
  }

  .story-body :global(a) {
    color: var(--color-link);
    text-decoration: underline;
  }

  .story-body :global(a:hover) {
    color: var(--color-accent);
  }

  .story-body :global(p) {
    margin-bottom: 6px;
  }

  .story-body :global(pre + p),
  .story-body :global(pre + *) {
    margin-top: 10px;
  }

  .story-body :global(pre) {
    background: var(--color-surface);
    padding: 8px;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    border: 1px solid var(--color-border);
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .story-body :global(pre::-webkit-scrollbar) {
    height: 6px;
  }

  .story-body :global(pre::-webkit-scrollbar-track) {
    background: transparent;
  }

  .story-body :global(pre::-webkit-scrollbar-thumb) {
    background: var(--color-border);
    border-radius: 3px;
  }

  .story-body :global(pre::-webkit-scrollbar-thumb:hover) {
    background: var(--color-text-faint);
  }

  .focus-breadcrumb {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 0 0 12px 0;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
  }

  .focus-breadcrumb button {
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .focus-breadcrumb button:hover {
    color: var(--color-text);
  }

  .focus-label {
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }

  .ai-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    width: 28px;
    height: 28px;
    color: var(--color-text-faint);
  }

  .ai-btn:hover:not(:disabled) {
    color: var(--color-accent);
  }

  .ai-btn:not(:disabled):hover {
    animation: spin 1.5s linear infinite;
  }

  .ai-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .summary-panel {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    padding: 12px;
    margin-bottom: 12px;
  }

  .summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    text-align: left;
    cursor: pointer;
  }

  .summary-label:hover {
    color: var(--color-text);
  }

  .summary-panel:has(.summary-body) .summary-header {
    margin-bottom: 8px;
  }

  .summary-label-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .summary-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-toggle-icon {
    font-size: 1.1rem;
    color: var(--color-text-muted);
    line-height: 0;
    margin-top: -2px;
  }

  .summary-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .action-icon {
    font-size: 0.85rem;
    color: var(--color-text-faint);
    padding: 0 2px;
    line-height: 1;
  }

  .action-icon:hover {
    color: var(--color-accent);
  }

  .action-icon.action-danger:hover {
    color: var(--color-danger);
  }

  .summary-body {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--color-text);
  }

  .summary-body :global(p) {
    margin-bottom: 6px;
  }

  .summary-body :global(ul),
  .summary-body :global(ol) {
    padding-left: 20px;
    margin-bottom: 6px;
  }

  .summary-body :global(li) {
    margin-bottom: 4px;
  }

  .summary-body :global(strong) {
    font-weight: 600;
  }

  .summary-body :global(a) {
    color: var(--color-link);
    text-decoration: underline;
  }

  .summary-body :global(a:hover) {
    color: var(--color-accent);
  }

  .summary-body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--color-surface-hover);
    padding: 1px 4px;
  }

  .summary-error {
    color: var(--color-danger);
  }

  .summary-loading {
    display: flex;
    justify-content: center;
    padding: 20px 0;
  }

  .summary-spinner {
    display: inline-block;
    font-size: 1.4rem;
    color: var(--color-accent);
    animation: spin 1.5s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .header-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    height: 100%;
  }

  .open-link {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    width: 28px;
    height: 28px;
    color: var(--color-text-faint);
    text-decoration: none;
  }

  .open-link:hover {
    color: var(--color-accent);
  }

  .flagged {
    color: var(--color-text-muted);
    padding: 16px 0;
  }

  .no-comments {
    color: var(--color-text-faint);
    padding: 16px 0;
  }

  .comments-loading {
    color: var(--color-text-muted);
    padding: 16px 0;
    font-size: 0.85rem;
  }

  .load-more-wrap {
    display: flex;
    justify-content: center;
    padding: 16px 0;
    border-top: 1px solid var(--color-border);
    margin-top: 12px;
  }

  .load-more-btn {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    padding: 6px 16px;
    border: 1px solid var(--color-border);
  }

  .load-more-btn:hover:not(:disabled) {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .load-more-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .tag-pill {
    display: inline-block;
    font-size: 0.7rem;
    padding: 1px 6px;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    text-decoration: none;
    vertical-align: middle;
    line-height: 1.4;
  }

  .tag-pill:hover {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .comment-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 8px;
  }

  .controls-left {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .controls-right {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .comments-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .comments-count {
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }

  .controls-sep {
    color: var(--color-border);
    font-size: 0.75rem;
    margin: 0 2px;
  }

  .control-btn {
    font-size: 0.75rem;
    color: var(--color-text-faint);
    padding: 2px 5px;
    border: 1px solid transparent;
  }

  .control-btn:hover {
    color: var(--color-text);
  }

  .control-btn.active {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .control-icon {
    font-size: 0.85rem;
    color: var(--color-text-faint);
    line-height: 1;
    padding: 0 2px;
  }

  .control-icon:hover:not(:disabled) {
    color: var(--color-accent);
  }

  .control-icon:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
