<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { type FeedType, type ContentSource, SOURCES, SOURCE_ID, AlgoliaClient, type FeedItem } from '@omnifeed/core'
  import StoryCard from '../components/StoryCard.svelte'
  import StoryCardSkeleton from '../components/StoryCardSkeleton.svelte'
  import { getKeyboardState } from '$lib/keyboard.svelte'
  import { getFeedState, loadFeed, loadMore } from '$lib/feed.svelte'

  const kb = getKeyboardState()
  const feed = getFeedState()
  const algolia = new AlgoliaClient()

  let source: ContentSource = $derived(
    (new URLSearchParams(page.url.search).get('source') as ContentSource) ?? 'hackernews'
  )

  let feedId: string = $derived(
    new URLSearchParams(page.url.search).get('feed') ?? SOURCES.find(s => s.id === source)?.feeds[0]?.id ?? 'top'
  )

  let tag: string | null = $derived(
    new URLSearchParams(page.url.search).get('tag')
  )

  let isHn = $derived(source === SOURCE_ID.HN)

  // Search state
  let searchInput: HTMLInputElement | undefined = $state()
  let searchQuery = $state('')
  let searchInputValue = $state('')
  let searchResults = $state<FeedItem[]>([])
  let searchLoading = $state(false)
  let searchFocused = $state(false)
  let searchActive = $state(false)
  let searchTotalPages = $state(0)
  let searchPage = $state(0)
  let searchSortByDate = $state(false)

  $effect(() => {
    loadFeed(source, feedId, tag)
  })

  $effect(() => {
    if (searchActive) {
      kb.storyIds = searchResults.map(r => r.id)
    } else {
      kb.storyIds = feed.items.map((s) => s.id)
    }
  })

  export function focusSearch() {
    searchInput?.focus()
  }

  async function doSearch() {
    if (!searchQuery.trim()) return
    searchLoading = true
    try {
      const result = await algolia.search(searchQuery.trim(), {
        page: searchPage,
        sortByDate: searchSortByDate,
      })
      searchResults = result.items
      searchTotalPages = result.totalPages
    } catch (err) {
      console.error('Search failed:', err)
      searchResults = []
    }
    searchLoading = false
  }

  function handleSearchSubmit(e: SubmitEvent) {
    e.preventDefault()
    searchQuery = searchInputValue
    searchPage = 0
    if (searchQuery.trim()) {
      searchActive = true
      doSearch()
    }
  }

  function clearSearch() {
    searchActive = false
    searchFocused = false
    searchQuery = ''
    searchInputValue = ''
    searchResults = []
    searchLoading = false
    searchPage = 0
    searchTotalPages = 0
    searchInput?.blur()
  }

  function searchNextPage() {
    if (searchPage < searchTotalPages - 1) {
      searchPage++
      doSearch()
      window.scrollTo(0, 0)
    }
  }

  function searchPrevPage() {
    if (searchPage > 0) {
      searchPage--
      doSearch()
      window.scrollTo(0, 0)
    }
  }

  function toggleSearchSort() {
    searchSortByDate = !searchSortByDate
    searchPage = 0
    doSearch()
  }
</script>

<svelte:window
  onscroll={() => {
    if (searchActive) return
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 500
    if (nearBottom && !feed.loading && !feed.loadingMore) {
      loadMore()
    }
  }}
/>

{#if isHn}
  <div class="search-bar" class:active={searchActive}>
    <form class="search-form" onsubmit={handleSearchSubmit}>
      <input
        bind:this={searchInput}
        class="search-input"
        type="text"
        placeholder="Search Hacker News..."
        bind:value={searchInputValue}
        onfocus={() => searchFocused = true}
        onblur={() => { if (!searchActive) searchFocused = false }}
        onkeydown={(e) => { if (e.key === 'Escape') { if (searchActive) clearSearch(); else { searchFocused = false; searchInputValue = ''; searchInput?.blur() } } }}
      />
      {#if searchFocused || searchActive}
        <button class="search-btn" type="submit">Search</button>
        {#if searchActive}
          <button class="search-btn" type="button" onclick={clearSearch}>Clear</button>
        {/if}
      {/if}
    </form>
    {#if searchActive && searchQuery}
      <div class="search-controls">
        <button class="sort-toggle" class:active={searchSortByDate} onclick={toggleSearchSort}>
          {searchSortByDate ? 'By date' : 'By relevance'}
        </button>
      </div>
    {/if}
  </div>
{/if}

{#if feed.tag && !searchActive}
  <div class="tag-header">
    <span class="tag-label">Tag: <strong>{feed.tag}</strong></span>
    <a href="/?source={source}&feed={feedId}" class="tag-clear">Clear</a>
  </div>
{/if}

<div class="feed">
  {#if searchActive}
    {#if searchLoading}
      {#each Array(10) as _}
        <StoryCardSkeleton />
      {/each}
    {:else if searchResults.length > 0}
      {#each searchResults as item, i}
        <StoryCard {item} index={i} selected={i === kb.selectedIndex} />
      {/each}
      <div class="pagination">
        <button onclick={searchPrevPage} disabled={searchPage === 0}>← Prev</button>
        <span class="page-info">Page {searchPage + 1} of {searchTotalPages}</span>
        <button onclick={searchNextPage} disabled={searchPage >= searchTotalPages - 1}>Next →</button>
      </div>
    {:else if searchQuery}
      <p class="no-results">No results for "{searchQuery}"</p>
    {/if}
  {:else if feed.loading}
    {#each Array(10) as _}
      <StoryCardSkeleton />
    {/each}
  {:else}
    {#each feed.items as item, i}
      <StoryCard {item} index={i} selected={i === kb.selectedIndex} />
    {/each}
    {#if feed.loadingMore}
      {#each Array(5) as _}
        <StoryCardSkeleton />
      {/each}
    {/if}
  {/if}
</div>

<style>
  .search-bar {
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .search-form {
    display: flex;
    gap: 8px;
  }

  .search-input {
    flex: 1;
    padding: 6px 10px;
    font-size: 0.85rem;
    font-family: var(--font-sans);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    outline: none;
  }

  .search-input:focus {
    border-color: var(--color-text-faint);
  }

  .search-input::placeholder {
    color: var(--color-text-faint);
  }

  .search-btn {
    padding: 6px 12px;
    font-size: 0.8rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
  }

  .search-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .search-controls {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }

  .sort-toggle {
    font-size: 0.75rem;
    color: var(--color-text-faint);
    padding: 3px 8px;
    border: 1px solid var(--color-border);
  }

  .sort-toggle.active {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .sort-toggle:hover {
    color: var(--color-text);
  }

  .tag-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
    font-size: 0.85rem;
  }

  .tag-label {
    color: var(--color-text-muted);
  }

  .tag-clear {
    color: var(--color-text-faint);
    text-decoration: none;
    font-size: 0.8rem;
  }

  .tag-clear:hover {
    color: var(--color-accent);
  }

  .feed {
    display: flex;
    flex-direction: column;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 16px 0 64px;
  }

  .pagination button {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    padding: 6px 12px;
    border: 1px solid var(--color-border);
  }

  .pagination button:hover:not(:disabled) {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }

  .pagination button:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .page-info {
    font-size: 0.8rem;
    color: var(--color-text-faint);
  }

  .no-results {
    color: var(--color-text-muted);
    padding: 16px 0;
  }
</style>
