<script lang="ts">
  import { page } from '$app/state'
  import { HnClient, type Story, type Comment as HnComment } from '@hackernews/core'
  import { timeAgo, domainFrom } from '$lib/time'
  import CommentTree from '../../../components/CommentTree.svelte'
  import SaveButton from '../../../components/SaveButton.svelte'
  import { setRefreshHandler } from '$lib/feed.svelte'

  const client = new HnClient()

  let story: Story | null = $state(null)
  let loading = $state(true)
  let focusStack: number[] = $state([])
  let focusedCommentIds: number[] = $state([])
  let refreshKey = $state(0)

  let itemId = $derived(Number(page.params.id))
  let domain = $derived(story ? domainFrom(story.url) : '')

  $effect(() => {
    loadStory(itemId)
  })

  $effect(() => {
    setRefreshHandler(() => {
      loadStory(itemId)
      refreshKey++
    })
    return () => setRefreshHandler(null)
  })

  async function loadStory(id: number) {
    loading = true
    focusStack = []
    focusedCommentIds = []
    const item = await client.fetchItem(id)
    if (item && 'title' in item) {
      story = item as Story
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
</script>

{#if loading}
  <p class="loading">loading...</p>
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
        {story.score} points | {story.by} | {timeAgo(story.time)} | {story.descendants ?? 0} comments
        {#if domain}
          | {domain}
        {/if}
      </div>
    </div>
    <div class="header-actions">
      <SaveButton itemId={story.id} />
      {#if story.url}
        <a href={story.url} target="_blank" rel="noopener" class="open-link" title="Open link">↗</a>
      {/if}
    </div>
  </header>

  {#if focusStack.length > 0}
    <div class="focus-breadcrumb">
      <button onclick={unfocus}>&larr; back</button>
      <span class="focus-label">focused ({focusStack.length} deep)</span>
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

  .focus-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    margin-bottom: 8px;
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

  .no-comments {
    color: var(--color-text-faint);
    padding: 16px 0;
  }
</style>
