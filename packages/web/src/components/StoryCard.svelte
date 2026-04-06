<script lang="ts">
  import type { Story } from '@hackernews/core'
  import { timeAgo, domainFrom } from '$lib/time'
  import SaveButton from './SaveButton.svelte'
  import { isRead, markRead } from '$lib/read-history.svelte'

  let { story, index, selected = false }: { story: Story; index: number; selected?: boolean } = $props()

  let domain = $derived(domainFrom(story.url))
  let read = $derived(isRead(story.id))
</script>

<a
  href="/item/{story.id}"
  class="story-card"
  class:selected
  class:read
  data-index={index}
  onclick={() => markRead(story.id)}
>
  <div class="story-main">
    <div class="title-row">
      <span class="rank">{index + 1}.</span>
      <span class="title">
        {story.title}
        {#if story.url}
          <a
            class="domain"
            href={story.url}
            target="_blank"
            rel="noopener"
            onclick={(e: MouseEvent) => e.stopPropagation()}
          >({domain})</a>
        {/if}
      </span>
    </div>
    <div class="meta">
      <span class="score">{story.score}</span>
      <span class="sep">|</span>
      <span>{story.by}</span>
      <span class="sep">|</span>
      <span>{timeAgo(story.time)}</span>
      {#if story.descendants > 0}
        <span class="sep">|</span>
        <span>{story.descendants}&nbsp;comments</span>
      {/if}
    </div>
  </div>
  <div class="card-actions">
    <SaveButton itemId={story.id} />
    {#if story.url}
      <a
        href={story.url}
        target="_blank"
        rel="noopener"
        class="open-link"
        title="Open link"
        onclick={(e: MouseEvent) => e.stopPropagation()}
      >↗</a>
    {/if}
  </div>
</a>

<style>
  .story-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
    text-decoration: none;
    color: inherit;
  }

  .story-card:hover {
    background: var(--color-surface-hover);
    color: inherit;
  }

  .story-card.selected {
    background: var(--color-surface-hover);
  }

  .story-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .rank {
    color: var(--color-text-faint);
    font-size: 0.85rem;
    min-width: 2.5ch;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .title {
    font-size: 1rem;
    line-height: 1.35;
  }

  .story-card.read .title {
    color: var(--color-text-faint);
  }

  .domain {
    font-size: 0.85rem;
    color: var(--color-text-faint);
    text-decoration: none;
  }

  .domain:hover {
    color: var(--color-accent);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    padding-left: calc(2.5ch + 6px);
  }

  .sep {
    color: var(--color-text-faint);
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .open-link {
    font-size: 1.1rem;
    padding: 4px 8px;
    color: var(--color-text-faint);
    text-decoration: none;
  }

  .open-link:hover {
    color: var(--color-accent);
  }

  .score {
    color: var(--color-text-muted);
  }
</style>
