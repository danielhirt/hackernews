<script lang="ts">
  import type { Comment } from '@hackernews/core'
  import { timeAgo } from '$lib/time'
  import CommentTree from './CommentTree.svelte'

  let {
    comment,
    depth = 0,
    focusPath = [],
    onfocus,
  }: {
    comment: Comment
    depth?: number
    focusPath?: number[]
    onfocus?: (id: number) => void
  } = $props()

  let collapsed = $state(false)
  let isFocused = $derived(focusPath.includes(comment.id))
</script>

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
        <span class="author">{comment.by}</span>
        <span class="time">{timeAgo(comment.time)}</span>
        {#if onfocus}
          <button class="focus-btn" onclick={() => onfocus(comment.id)} title="Focus thread">
            [f]
          </button>
        {/if}
      </div>
      {#if !collapsed}
        <div class="comment-body">{@html comment.text}</div>
        {#if comment.kids?.length}
          <CommentTree
            commentIds={comment.kids}
            depth={depth + 1}
            {focusPath}
            {onfocus}
          />
        {/if}
      {:else}
        <span class="collapsed-hint">
          {comment.kids?.length ?? 0} replies
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
  }

  .time {
    color: var(--color-text-faint);
  }

  .focus-btn {
    color: var(--color-text-faint);
    font-size: 0.85rem;
    font-family: var(--font-mono);
    padding: 0;
    line-height: 1;
    opacity: 0;
  }

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
  }

  .comment-body :global(p) {
    margin-bottom: 6px;
  }

  .collapsed-hint {
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }
</style>
