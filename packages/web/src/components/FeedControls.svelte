<script lang="ts" module>
  export type FeedFilter = 'all' | 'unread' | 'saved'
  export type SourceFilter = 'all' | 'hackernews' | 'lobsters' | 'devto'
</script>

<script lang="ts">
  import { refreshFeed } from '$lib/feed.svelte'

  import type { Snippet } from 'svelte'
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
</script>

<div class="feed-controls">
  {#if children}{@render children()}{/if}
  {#if isOmnifeed}
    <button
      class="filter-btn"
      class:active={omnifeedMode === 'newest'}
      onclick={() => omnifeedMode = 'newest'}
    >Newest</button>
    <button
      class="filter-btn"
      class:active={omnifeedMode === 'hottest'}
      onclick={() => omnifeedMode = 'hottest'}
    >Hottest</button>
    <span class="filter-sep">|</span>
    <button
      class="filter-btn"
      class:active={sourceFilter === 'hackernews'}
      onclick={() => sourceFilter = sourceFilter === 'hackernews' ? 'all' : 'hackernews'}
    >HN</button>
    <button
      class="filter-btn compact"
      class:active={sourceFilter === 'lobsters'}
      onclick={() => sourceFilter = sourceFilter === 'lobsters' ? 'all' : 'lobsters'}
    >Lobsters</button>
    <button
      class="filter-btn compact"
      class:active={sourceFilter === 'devto'}
      onclick={() => sourceFilter = sourceFilter === 'devto' ? 'all' : 'devto'}
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
    onclick={() => filter = 'unread'
  }>Unread</button>
  <button
    class="filter-btn compact"
    class:active={filter === 'saved'}
    onclick={() => filter = 'saved'}
  >Saved</button>
  <span class="filter-sep">|</span>
  <button class="refresh-btn" onclick={refreshFeed} title="Refresh feed (r)">↻</button>
</div>

<style>
  .feed-controls {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    padding: 6px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .filter-btn {
    font-size: 0.75rem;
    color: var(--color-text-faint);
    padding: 2px 5px;
    border: 1px solid transparent;
  }

  .filter-btn:hover {
    color: var(--color-text);
  }

  .filter-btn.compact {
    padding: 2px 3px;
  }

  .filter-btn.active {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .filter-sep {
    color: var(--color-border);
    font-size: 0.75rem;
  }

  .refresh-btn {
    font-size: 0.95rem;
    color: var(--color-text-faint);
  }

  .refresh-btn:hover {
    color: var(--color-accent);
  }

</style>
