<script lang="ts">
  import type { FeedType } from '@hackernews/core'
  import { page } from '$app/state'
  import { refreshFeed } from '$lib/feed.svelte'
  import { getTheme, toggleTheme } from '$lib/theme.svelte'

  const theme = getTheme()

  const feeds: { type: FeedType; label: string; key: string }[] = [
    { type: 'top', label: 'top', key: '1' },
    { type: 'new', label: 'new', key: '2' },
    { type: 'best', label: 'best', key: '3' },
    { type: 'ask', label: 'ask', key: '4' },
    { type: 'show', label: 'show', key: '5' },
    { type: 'job', label: 'jobs', key: '6' },
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
        title="{feed.key}"
      >
        {feed.label}
      </a>
    {/each}
  </div>
  <div class="nav-links">
    <button class="nav-link" onclick={refreshFeed} title="Refresh feed (r)">refresh</button>
    <a href="/collections" class="nav-link">collections</a>
    <button class="nav-link theme-toggle" onclick={toggleTheme} title="Toggle theme">
      {theme.value === 'dark' ? '☀' : '☾'}
    </button>
  </div>
</nav>

<style>
  .navbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: baseline;
    padding: 10px 16px;
    border-bottom: 1px solid var(--color-border);
    max-width: var(--max-width);
    margin: 0 auto;
  }

  .logo {
    font-weight: 700;
    font-size: 1rem;
    color: var(--color-accent);
    text-decoration: none;
    letter-spacing: -0.02em;
  }

  .feed-tabs {
    display: flex;
    gap: 16px;
    justify-content: center;
  }

  .tab {
    color: var(--color-text-muted);
    font-size: 0.9rem;
    text-decoration: none;
  }

  .tab:hover {
    color: var(--color-text);
  }

  .tab.active {
    color: var(--color-accent);
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: flex-end;
  }

  .nav-link {
    font-size: 0.85rem;
    color: var(--color-text-faint);
    text-decoration: none;
  }

  .nav-link:hover {
    color: var(--color-text);
  }

  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    line-height: 1;
  }
</style>
