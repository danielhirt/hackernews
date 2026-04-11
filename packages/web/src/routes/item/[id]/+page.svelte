<script lang="ts">
  import { page } from '$app/state'
  import { HnClient, type Story, type Comment as HnComment } from '@hackernews/core'
  import { timeAgo, domainFrom } from '$lib/time'
  import CommentTree from '../../../components/CommentTree.svelte'
  import SaveButton from '../../../components/SaveButton.svelte'
  import { setRefreshHandler } from '$lib/feed.svelte'
  import { marked } from 'marked'
  import { getSummary, saveSummary, clearSummary, isExpanded, setExpanded } from '$lib/summaries.svelte'
  import { getSettings } from '$lib/settings.svelte'

  const client = new HnClient()

  let story: Story | null = $state(null)
  let flagged = $state(false)
  let loading = $state(true)
  let focusStack: number[] = $state([])
  let focusedCommentIds: number[] = $state([])
  let refreshKey = $state(0)

  let numericId = $derived(Number(page.params.id))
  let itemId = $derived(story ? `hn:${story.id}` : '')
  let domain = $derived(story ? domainFrom(story.url) : '')

  $effect(() => {
    loadStory(numericId)
  })

  $effect(() => {
    setRefreshHandler(() => {
      loadStory(numericId)
      refreshKey++
    })
    return () => setRefreshHandler(null)
  })

  async function loadStory(id: number) {
    loading = true
    flagged = false
    focusStack = []
    focusedCommentIds = []
    const item = await client.fetchItem(id)
    if (item && 'title' in item) {
      story = item as Story
    } else if (item && ('dead' in item || !('title' in item))) {
      flagged = true
    }
    loading = false
  }

  function focusComment(commentId: number) {
    focusStack = [...focusStack, commentId]
    focusedCommentIds = [commentId]
  }

  function unfocus() {
    focusStack = focusStack.slice(0, -1)
    focusedCommentIds = focusStack.length > 0 ? [focusStack[focusStack.length - 1]] : []
  }

  let displayedCommentIds = $derived(
    focusedCommentIds.length > 0 ? focusedCommentIds : (story?.kids ?? [])
  )

  const appSettings = getSettings()

  let summaryText = $state('')
  let summaryExpanded = $state(false)
  let summaryLoading = $state(false)
  let summaryError = $state('')

  let hasSummary = $derived(!!summaryText || summaryLoading || !!summaryError)

  // Restore cached summary when story loads
  $effect(() => {
    if (story) {
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
    if (!story) return
    let content = ''
    if (story.text) content += stripHtml(story.text)
    if (story.url) {
      if (content) content += '\n\n'
      content += story.url
    }
    if (!content) return
    await navigator.clipboard.writeText(content)
    postCopied = true
    setTimeout(() => postCopied = false, 1500)
  }

  function toggleSummary() {
    if (!story) return
    if (!summaryText && !summaryLoading) {
      fetchSummary()
      return
    }
    summaryExpanded = !summaryExpanded
    setExpanded(itemId, summaryExpanded)
  }

  async function fetchSummary() {
    if (!story) return
    summaryExpanded = true
    summaryText = ''
    summaryError = ''
    summaryLoading = true

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: story.id, model: appSettings.value.model }),
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

{#if loading}
  <p class="loading">Loading...</p>
{:else if flagged}
  <p class="flagged">This item has been flagged or removed.</p>
{:else if story}
  <header class="story-header">
    <div class="story-text">
      <h1 class="story-title">
        {#if story.url}
          <a href={story.url} target="_blank" rel="noopener">{story.title}</a>
        {:else}
          {story.title}
        {/if}
      </h1>
      <div class="story-meta">
        {story.score} points | <a href="/user/{story.by}" class="author">{story.by}</a> | {timeAgo(story.time)} | {story.descendants ?? 0} comments
        {#if domain}
          | {domain}
        {/if}
      </div>
    </div>
    <div class="header-actions">
      <button class="ai-btn" onclick={toggleSummary} title="AI summary" disabled={summaryLoading}>✦</button>
      <SaveButton {itemId} />
      {#if story.url}
        <a href={story.url} target="_blank" rel="noopener" class="open-link" title="Open link">↗</a>
      {/if}
    </div>
  </header>

  {#if hasSummary}
    <div class="summary-panel">
      <button class="summary-header" onclick={() => { summaryExpanded = !summaryExpanded; if (story) setExpanded(itemId, summaryExpanded) }}>
        <span class="summary-label">AI Summary {summaryExpanded ? '▾' : '▸'}</span>
        <div class="summary-actions" onclick={(e) => e.stopPropagation()}>
          {#if summaryText && !summaryLoading}
            <button class="summary-copy" onclick={copySummary}>{summaryCopied ? 'Copied!' : 'Copy'}</button>
            <button class="summary-regen" onclick={fetchSummary}>Regenerate</button>
            <button class="summary-dismiss" onclick={() => { if (story) { clearSummary(itemId); summaryText = ''; summaryError = ''; summaryExpanded = false } }}>Dismiss</button>
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

  {#if story.text}
    <div class="story-body-wrapper">
      <div class="story-body">{@html story.text}</div>
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
    {#if displayedCommentIds.length > 0}
      {#key refreshKey}
        <CommentTree
          commentIds={displayedCommentIds}
          {client}
          focusPath={focusStack}
          onfocus={focusComment}
        />
      {/key}
    {:else}
      <p class="no-comments">No comments.</p>
    {/if}
  </section>
{/if}

<style>
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
    font-size: 1.15rem;
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
    font-size: 1.1rem;
    width: 28px;
    height: 28px;
    color: var(--color-text-faint);
  }

  .ai-btn:hover:not(:disabled) {
    color: var(--color-accent);
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
  }

  .summary-label:hover {
    color: var(--color-text);
  }

  .summary-panel:has(.summary-body) .summary-header {
    margin-bottom: 8px;
  }

  .summary-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .summary-copy,
  .summary-regen {
    font-size: 0.7rem;
    color: var(--color-text-faint);
    padding: 2px 6px;
    border: 1px solid var(--color-border);
  }

  .summary-copy:hover,
  .summary-regen:hover {
    color: var(--color-text);
    border-color: var(--color-text-faint);
  }

  .summary-dismiss {
    font-size: 0.7rem;
    color: var(--color-text-faint);
    padding: 2px 6px;
    border: 1px solid var(--color-border);
  }

  .summary-dismiss:hover {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  .summary-body {
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--color-text);
  }

  .summary-body :global(h2),
  .summary-body :global(h3) {
    font-size: 0.9rem;
    font-weight: 600;
    margin-top: 10px;
    margin-bottom: 4px;
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
    font-size: 0.85rem;
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
</style>
