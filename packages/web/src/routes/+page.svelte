<script lang="ts">
  import { page } from '$app/state'
  import { type ContentSource, SOURCES, SOURCE_ID, AlgoliaClient, type FeedItem, type OmnifeedMode } from '@omnifeed/core'
  import StoryCard from '../components/StoryCard.svelte'
  import StoryCardSkeleton from '../components/StoryCardSkeleton.svelte'
  import { getKeyboardState } from '$lib/keyboard.svelte'
  import { getFeedState, loadFeed, loadMore, loadOmnifeed } from '$lib/feed.svelte'
  import FeedControls, { type FeedFilter, type SourceFilter } from '../components/FeedControls.svelte'
  import { isRead } from '$lib/read-history.svelte'
  import { getCollections } from '$lib/collections.svelte'

  const kb = getKeyboardState()
  const feed = getFeedState()
  const cols = getCollections()
  const algolia = new AlgoliaClient()

  let sourceParam = $derived(
    new URLSearchParams(page.url.search).get('source') as ContentSource | null
  )

  let isOmnifeed = $derived(sourceParam === null)

  let source: ContentSource = $derived(sourceParam ?? 'hackernews')

  let feedId: string = $derived(
    new URLSearchParams(page.url.search).get('feed') ?? SOURCES.find(s => s.id === source)?.feeds[0]?.id ?? 'top'
  )

  let tag: string | null = $derived(
    new URLSearchParams(page.url.search).get('tag')
  )

  let isHn = $derived(source === SOURCE_ID.HN)

  // Feed filter
  let feedFilter = $state<FeedFilter>('all')
  let omnifeedMode = $state<OmnifeedMode>('newest')
  let sourceFilter = $state<SourceFilter>('all')
  let savedIds = $derived(new Set(cols.value.flatMap(c => c.itemIds)))

  let filteredItems = $derived.by(() => {
    let result = feed.items
    if (sourceFilter !== 'all') {
      result = result.filter(item => item.source === sourceFilter)
    }
    if (feedFilter === 'unread') return result.filter(item => !isRead(item.id))
    if (feedFilter === 'saved') return result.filter(item => savedIds.has(item.id))
    return result
  })

  // Reset filter when source, feed, or tag changes
  $effect(() => {
    source; feedId; tag; isOmnifeed; omnifeedMode;
    feedFilter = 'all'
    sourceFilter = 'all'
  })

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
    if (isOmnifeed) {
      loadOmnifeed(omnifeedMode)
    } else {
      loadFeed(source, feedId, tag)
    }
  })

  $effect(() => {
    if (searchActive) {
      kb.storyIds = searchResults.map(r => r.id)
    } else {
      kb.storyIds = filteredItems.map((s) => s.id)
    }
  })

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

{#if !feed.loading}
  {#if !isOmnifeed && searchActive && searchQuery}
    <div class="search-controls">
      <form class="search-form" onsubmit={handleSearchSubmit}>
        <span class="search-field">
          <span class="search-icon">⌕</span>
          <input
            bind:this={searchInput}
            class="search-input"
            type="text"
            placeholder="Search HN..."
            bind:value={searchInputValue}
            onfocus={() => searchFocused = true}
            onblur={() => { if (!searchActive) searchFocused = false }}
            onkeydown={(e) => { if (e.key === 'Escape') { if (searchActive) clearSearch(); else { searchFocused = false; searchInputValue = ''; searchInput?.blur() } } }}
          />
        </span>
        <button class="search-btn" type="submit">Search</button>
        <button class="search-btn" type="button" onclick={clearSearch}>Clear</button>
      </form>
      <button class="sort-toggle" class:active={searchSortByDate} onclick={toggleSearchSort}>
        {searchSortByDate ? 'By date' : 'By relevance'}
      </button>
    </div>
  {:else}
    <FeedControls
      bind:filter={feedFilter}
      bind:sourceFilter={sourceFilter}
      bind:omnifeedMode={omnifeedMode}
      {isOmnifeed}
    >
      {#if feed.tag}
        <span class="tag-info">
          <button class="back-link" onclick={() => history.back()}>← Back</button>
          <span class="tag-label">Tag: <strong>{feed.tag}</strong></span>
        </span>
      {:else if isHn && !isOmnifeed}
        <form class="search-form" onsubmit={handleSearchSubmit}>
          <span class="search-field">
            <span class="search-icon">⌕</span>
            <input
              bind:this={searchInput}
              class="search-input"
              type="text"
              placeholder="Search HN..."
              bind:value={searchInputValue}
              onfocus={() => searchFocused = true}
              onblur={() => { if (!searchActive) searchFocused = false }}
              onkeydown={(e) => { if (e.key === 'Escape') { if (searchActive) clearSearch(); else { searchFocused = false; searchInputValue = ''; searchInput?.blur() } } }}
            />
          </span>
          {#if searchFocused}
            <button class="search-btn" type="submit">Search</button>
          {/if}
        </form>
      {/if}
    </FeedControls>
  {/if}
{/if}

<div class="feed">
  {#if searchActive}
    {#if searchLoading}
      {#each Array(10) as _}
        <StoryCardSkeleton />
      {/each}
    {:else if searchResults.length > 0}
      {#each searchResults as item, i (item.id)}
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
  {:else if filteredItems.length > 0}
    {#each filteredItems as item, i (item.id)}
      <StoryCard {item} index={i} selected={i === kb.selectedIndex} />
    {/each}
    {#if feed.loadingMore}
      {#each Array(5) as _}
        <StoryCardSkeleton />
      {/each}
    {/if}
  {:else if feedFilter === 'unread'}
    <p class="no-results">No unread items.</p>
  {:else if feedFilter === 'saved'}
    <p class="no-results">No saved items in this feed.</p>
  {/if}
</div>

<style>
  .search-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .search-form {
    display: flex;
    gap: 6px;
    margin-right: auto;
  }

  .search-field {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 5px;
    font-size: 1.2rem;
    color: var(--color-text-faint);
    pointer-events: none;
    line-height: 1;
  }

  .search-input {
    width: 180px;
    padding: 3px 8px 3px 22px;
    font-size: 0.8rem;
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
    padding: 3px 8px;
    font-size: 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
  }

  .search-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .sort-toggle {
    font-size: 0.75rem;
    color: var(--color-text-faint);
    padding: 2px 5px;
    border: 1px solid var(--color-border);
  }

  .sort-toggle.active {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .sort-toggle:hover {
    color: var(--color-text);
  }

  .tag-info {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-right: auto;
    font-size: 0.85rem;
  }

  .back-link {
    font-size: 0.8rem;
    color: var(--color-text-faint);
  }

  .back-link:hover {
    color: var(--color-accent);
  }

  .tag-label {
    color: var(--color-text-muted);
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
