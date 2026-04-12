<script lang="ts">
  import { SOURCES, parseItemId, type ContentSource } from '@omnifeed/core'
  import { page } from '$app/state'
  import { getFeedState } from '$lib/feed.svelte'
  import { getTheme, toggleTheme } from '$lib/theme.svelte'

  const theme = getTheme()

  const feed = getFeedState()
  let showSourceMenu = $state(false)

  let currentSource = $derived.by<ContentSource>(() => {
    const param = new URLSearchParams(page.url.search).get('source') as ContentSource | null
    if (param) return param

    // Detect source from /item/[id] route prefix
    const match = page.url.pathname.match(/^\/item\/([^/]+)/)
    if (match) {
      return parseItemId(match[1]).source
    }

    // On non-feed pages (collections, settings), preserve last browsed source
    return feed.source
  })
  let currentFeed = $derived(
    new URLSearchParams(page.url.search).get('feed') ?? feed.feedId
  )
  let sourceConfig = $derived(SOURCES.find(s => s.id === currentSource) ?? SOURCES[0])
  let isOmnifeed = $derived(
    page.url.pathname === '/' && !new URLSearchParams(page.url.search).has('source')
  )
</script>

<nav class="navbar">
  <div class="source-selector">
    <button
      class="source-btn"
      style={isOmnifeed ? '' : `color: ${sourceConfig.color}`}
      onclick={() => showSourceMenu = !showSourceMenu}
    >
      {isOmnifeed ? 'Omnifeed' : sourceConfig.shortName} <span class="arrow">▾</span>
    </button>
    {#if showSourceMenu}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="source-backdrop" onclick={() => showSourceMenu = false}></div>
      <div class="source-menu">
        <a
          href="/"
          class="source-option"
          class:active={isOmnifeed}
          onclick={() => showSourceMenu = false}
        >
          <span class="source-dot" style="background: var(--color-accent)"></span>
          Omnifeed
        </a>
        {#each SOURCES as source}
          <a
            href="/?source={source.id}&feed={source.feeds[0].id}"
            class="source-option"
            class:active={!isOmnifeed && source.id === currentSource}
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
    {#if !isOmnifeed}
      {#each sourceConfig.feeds as f, i}
        <a
          href="/?source={currentSource}&feed={f.id}"
          class="tab"
          class:active={!feed.tag && currentFeed === f.id}
          title="{String(i + 1)}"
        >
          {f.label}
        </a>
      {/each}
    {/if}
  </div>
  <div class="nav-links">
    <a href="/collections" class="nav-link">Collections</a>
    <span class="nav-divider">|</span>
    <button class="icon-btn" onclick={toggleTheme} title="Toggle theme">
      {theme.value === 'dark' ? '☀' : '☾'}
    </button>
    <a href="/settings" class="icon-btn settings-icon" title="Settings">⚙</a>
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

  .nav-divider {
    color: var(--color-border);
    font-size: 0.85rem;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    line-height: 1;
    color: var(--color-text-faint);
    text-decoration: none;
  }

  .icon-btn:hover {
    color: var(--color-text);
  }

  .settings-icon {
    font-size: 1.3rem;
    margin-top: -2px;
  }
</style>
