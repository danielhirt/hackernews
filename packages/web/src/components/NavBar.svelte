<script lang="ts">
  import type { FeedType } from '@hackernews/core'
  import { page } from '$app/state'

  const feeds: { type: FeedType; label: string; key: string }[] = [
    { type: 'top', label: 'Top', key: '1' },
    { type: 'new', label: 'New', key: '2' },
    { type: 'best', label: 'Best', key: '3' },
    { type: 'ask', label: 'Ask', key: '4' },
    { type: 'show', label: 'Show', key: '5' },
    { type: 'job', label: 'Jobs', key: '6' },
  ]

  let currentFeed = $derived(
    new URLSearchParams(page.url.search).get('feed') ?? 'top'
  )
</script>

<nav class="navbar">
  <a href="/" class="logo">HN</a>
  <div class="feed-tabs">
    {#each feeds as feed}
      <a
        href="/?feed={feed.type}"
        class="tab"
        class:active={currentFeed === feed.type}
        title="Press {feed.key} to switch"
      >
        {feed.label}
      </a>
    {/each}
  </div>
  <a href="/collections" class="collections-link">Collections</a>
</nav>

<style>
  .navbar {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md) var(--space-lg);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .logo {
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--color-accent);
    text-decoration: none;
  }

  .feed-tabs {
    display: flex;
    gap: var(--space-xs);
  }

  .tab {
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }

  .tab:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .tab.active {
    background: var(--color-accent);
    color: var(--color-bg);
  }

  .collections-link {
    margin-left: auto;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .collections-link:hover {
    color: var(--color-text);
  }
</style>
