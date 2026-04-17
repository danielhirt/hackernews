<script lang="ts">
  import { SOURCE_ID, type CommentItem } from '@omnifeed/core'
  import { timeAgo } from '$lib/time'
  import { sanitizeHtml } from '$lib/sanitize'
  import CommentTree from './CommentTree.svelte'

  let {
    comment,
    depth = 0,
    focusPath = [],
    onfocus,
    onloadchildren,
    defaultCollapsed = false,
  }: {
    comment: CommentItem
    depth?: number
    focusPath?: string[]
    onfocus?: (id: string) => void
    onloadchildren?: (id: string) => Promise<void>
    defaultCollapsed?: boolean
  } = $props()

  let collapsed = $state(false)
  let loadingChildren = $state(false)

  $effect(() => {
    collapsed = defaultCollapsed
  })

  let isFocused = $derived(focusPath.includes(comment.id))
  let isHn = $derived(comment.source === SOURCE_ID.HN)
  let copied = $state(false)
  let pendingCount = $derived(comment.pendingKidIds?.length ?? 0)
  let hasPendingKids = $derived(pendingCount > 0)
  // Total reply count for display: actual + pending
  let replyCount = $derived(comment.children.length + pendingCount)

  async function loadPendingChildren() {
    if (!onloadchildren || !hasPendingKids || loadingChildren) return
    loadingChildren = true
    try {
      await onloadchildren(comment.id)
    } finally {
      loadingChildren = false
    }
  }

  async function handleToggle() {
    const willExpand = collapsed
    collapsed = !collapsed
    // When expanding from collapsed and children are pending, kick off the fetch
    if (willExpand) {
      await loadPendingChildren()
    }
  }

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

{#if !comment.deleted && !comment.dead}
  <div class="comment-node" class:focused={isFocused}>
    {#if depth > 0}
      <div class="indent-guide"></div>
    {/if}
    <div class="comment-content">
      <div class="comment-header">
        <button class="collapse-toggle" onclick={handleToggle}>
          {collapsed ? '[+]' : '[-]'}
        </button>
        {#if isHn}
          <a href="/user/{comment.author}" class="author">{comment.author}</a>
        {:else if comment.source === SOURCE_ID.LOBSTERS}
          <a href="/user/{comment.author}?source=lobsters" class="author">{comment.author}</a>
        {:else}
          <span class="author">{comment.author}</span>
        {/if}
        <span class="time">{timeAgo(comment.timestamp)}</span>
        {#if comment.score !== undefined}<span class="score">{comment.score} pts</span>{/if}
        <button class="copy-btn" onclick={copyComment} title="Copy comment">
          {copied ? '✓' : '⧉'}
        </button>
        {#if onfocus && replyCount}
          <button class="focus-btn" onclick={() => onfocus(comment.id)} title="Focus thread">
            [f]
          </button>
        {/if}
      </div>
      {#if !collapsed}
        <div class="comment-body">{@html sanitizeHtml(comment.text)}</div>
        {#if loadingChildren}
          <span class="children-loading">Loading replies...</span>
        {:else if hasPendingKids && comment.children.length === 0}
          <button class="show-replies-btn" onclick={loadPendingChildren}>
            Show {pendingCount} {pendingCount === 1 ? 'reply' : 'replies'}
          </button>
        {/if}
        {#if comment.children.length}
          <CommentTree
            comments={comment.children}
            depth={depth + 1}
            {focusPath}
            {onfocus}
            {onloadchildren}
            {defaultCollapsed}
          />
        {/if}
      {:else if replyCount}
        <span class="collapsed-hint">
          {replyCount} replies
        </span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .comment-node {
    display: flex;
    gap: 8px;
    padding-top: 6px;
  }

  .comment-node.focused {
    background: var(--color-surface-hover);
    padding: 6px 8px;
    border-radius: 4px;
  }

  .indent-guide {
    flex-shrink: 0;
    width: 0;
    border-left: 1px solid var(--color-border);
    margin-left: 8px;
  }

  .comment-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .comment-header {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 0.85rem;
  }

  .collapse-toggle {
    font-size: 0.75rem;
    color: var(--color-text-faint);
    padding: 0;
    line-height: 1;
    font-family: var(--font-mono);
  }

  .author {
    color: var(--color-text);
    font-weight: 600;
    text-decoration: none;
  }

  .author:hover {
    color: var(--color-accent);
  }

  .time {
    color: var(--color-text-faint);
  }

  .score {
    color: var(--color-text-faint);
    font-size: 0.8rem;
  }

  .copy-btn:hover,
  .focus-btn:hover {
    color: var(--color-accent);
  }

  .focus-btn {
    color: var(--color-text-faint);
    font-size: 0.85rem;
    font-family: var(--font-mono);
    padding: 0;
    line-height: 1;
    opacity: 0;
  }

  .copy-btn {
    color: var(--color-text-faint);
    font-size: 0.95rem;
    padding: 0;
    opacity: 0;
    align-self: center;
  }

  .comment-header:hover .copy-btn,
  .comment-header:hover .focus-btn {
    opacity: 1;
  }

  .comment-body {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--color-text);
    overflow-wrap: break-word;
  }

  .comment-body :global(a) {
    color: var(--color-link);
    text-decoration: underline;
  }

  .comment-body :global(a:hover) {
    color: var(--color-accent);
  }


  .comment-body :global(pre) {
    background: var(--color-surface);
    padding: 8px;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    border: 1px solid var(--color-border);
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .comment-body :global(pre::-webkit-scrollbar) {
    height: 6px;
  }

  .comment-body :global(pre::-webkit-scrollbar-track) {
    background: transparent;
  }

  .comment-body :global(pre::-webkit-scrollbar-thumb) {
    background: var(--color-border);
    border-radius: 3px;
  }

  .comment-body :global(pre::-webkit-scrollbar-thumb:hover) {
    background: var(--color-text-faint);
  }

  .comment-body :global(p) {
    margin-bottom: 6px;
  }

  .comment-body :global(pre + p),
  .comment-body :global(pre + *) {
    margin-top: 10px;
  }

  .collapsed-hint {
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }

  .children-loading {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    padding: 4px 0;
  }

  .show-replies-btn {
    align-self: flex-start;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    padding: 2px 0;
    text-align: left;
  }

  .show-replies-btn:hover {
    color: var(--color-accent);
  }
</style>
