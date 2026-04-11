<script lang="ts">
  import { SOURCES, type ContentSource } from '@hackernews/core'
  import { page } from '$app/state'
  import { refreshFeed } from '$lib/feed.svelte'
  import { getTheme, toggleTheme } from '$lib/theme.svelte'

  const theme = getTheme()

  let showSourceMenu = $state(false)

  let currentSource = $derived<ContentSource>(
    (new URLSearchParams(page.url.search).get('source') as ContentSource) ?? 'hackernews'
  )
  let currentFeed = $derived(
    new URLSearchParams(page.url.search).get('feed') ?? SOURCES.find(s => s.id === currentSource)?.feeds[0]?.id ?? 'top'
  )
  let sourceConfig = $derived(SOURCES.find(s => s.id === currentSource) ?? SOURCES[0])
</script>

<nav class="navbar">
  <div class="source-selector">
    <button
      class="source-btn"
      style="color: {sourceConfig.color}"
      onclick={() => showSourceMenu = !showSourceMenu}
    >
      {sourceConfig.shortName} <span class="arrow">▾</span>
    </button>
    {#if showSourceMenu}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="source-backdrop" onclick={() => showSourceMenu = false}></div>
      <div class="source-menu">
        {#each SOURCES as source}
          <a
            href="/?source={source.id}&feed={source.feeds[0].id}"
            class="source-option"
            class:active={source.id === currentSource}
            onclick={() => showSourceMenu = false}
          >
            <span class="source-dot" style="background: {source.color}"></span>
            {source.name}
          </a>
        {/each}
      </div>
    {/if}
  </div>
  <div class="feed-tabs">
    {#each sourceConfig.feeds as feed, i}
      <a
        href="/?source={currentSource}&feed={feed.id}"
        class="tab"
        class:active={currentFeed === feed.id}
        title="{i + 1}"
      >
        {feed.label}
      </a>
    {/each}
  </div>
  <div class="nav-links">
    <button class="nav-link" onclick={refreshFeed} title="Refresh feed (r)">Refresh</button>
    <a href="/search" class="nav-link" title="Search HN (/)">Search</a>
    <a href="/collections" class="nav-link">Collections</a>
    <a href="/settings" class="nav-link">Settings</a>
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

  .source-selector {
    position: relative;
  }

  .source-btn {
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .source-btn:hover {
    opacity: 0.8;
  }

  .arrow {
    font-size: 0.7rem;
    opacity: 0.6;
  }

  .source-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9;
  }

  .source-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    padding: 4px;
    z-index: 10;
    min-width: 160px;
  }

  .source-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .source-option:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .source-option.active {
    color: var(--color-accent);
  }

  .source-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
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
