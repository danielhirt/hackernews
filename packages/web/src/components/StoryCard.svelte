<script lang="ts">
  import type { Story } from '@hackernews/core'
  import { timeAgo, domainFrom } from '$lib/time'

  let { story, index, selected = false }: { story: Story; index: number; selected?: boolean } = $props()

  let domain = $derived(domainFrom(story.url))
</script>

<a
  href="/item/{story.id}"
  class="story-card"
  class:selected
  data-index={index}
>
  <div class="story-main">
    <div class="title-row">
      <span class="rank">{index + 1}.</span>
      <h2 class="title">
        {story.title}
        {#if domain}
          <span class="domain">({domain})</span>
        {/if}
      </h2>
    </div>
    <div class="meta">
      <span class="score">{story.score} points</span>
      <span class="sep">&middot;</span>
      <span class="author">{story.by}</span>
      <span class="sep">&middot;</span>
      <span class="time">{timeAgo(story.time)}</span>
      {#if story.descendants > 0}
        <span class="sep">&middot;</span>
        <span class="comments">{story.descendants} comments</span>
      {/if}
    </div>
  </div>
</a>

<style>
  .story-card {
    display: flex;
    align-items: flex-start;
    padding: var(--space-md);
    border-bottom: 1px solid var(--color-border);
    text-decoration: none;
    color: inherit;
    transition: background 0.15s;
  }

  .story-card:hover,
  .story-card.selected {
    background: var(--color-surface-hover);
  }

  .story-main {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }

  .rank {
    color: var(--color-text-faint);
    font-size: 0.875rem;
    min-width: 2ch;
    text-align: right;
  }

  .title {
    font-size: 1rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .domain {
    font-size: 0.8rem;
    color: var(--color-text-faint);
    font-weight: 400;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: 0.8rem;
    color: var(--color-text-muted);
    padding-left: calc(2ch + var(--space-sm));
  }

  .sep {
    color: var(--color-text-faint);
  }

  .score {
    color: var(--color-accent);
  }
</style>
