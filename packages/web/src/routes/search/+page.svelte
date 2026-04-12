<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { AlgoliaClient, type FeedItem } from '@omnifeed/core'
  import StoryCard from '../../components/StoryCard.svelte'
  import StoryCardSkeleton from '../../components/StoryCardSkeleton.svelte'
  import { getKeyboardState } from '$lib/keyboard.svelte'

  const kb = getKeyboardState()
  const client = new AlgoliaClient()

  let query = $state(new URLSearchParams(page.url.search).get('q') ?? '')
  let inputValue = $state(query)
  let results = $state<FeedItem[]>([])
  let loading = $state(false)
  let searched = $state(false)
  let totalPages = $state(0)
  let currentPage = $state(0)
  let sortByDate = $state(false)

  $effect(() => {
    const q = new URLSearchParams(page.url.search).get('q') ?? ''
    if (q && q !== query) {
      query = q
      inputValue = q
      doSearch()
    }
  })

  $effect(() => {
    kb.storyIds = results.map(r => r.id)
  })

  async function doSearch() {
    if (!query.trim()) return
    loading = true
    searched = true
    try {
      const result = await client.search(query.trim(), {
        page: currentPage,
        sortByDate,
      })
      results = result.items
      totalPages = result.totalPages
    } catch (err) {
      console.error('Search failed:', err)
      results = []
    }
    loading = false
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    query = inputValue
    currentPage = 0
    goto(`/search?q=${encodeURIComponent(query)}`, { replaceState: true })
    doSearch()
  }

  function nextPage() {
    if (currentPage < totalPages - 1) {
      currentPage++
      doSearch()
      window.scrollTo(0, 0)
    }
  }

  function prevPage() {
    if (currentPage > 0) {
      currentPage--
      doSearch()
      window.scrollTo(0, 0)
    }
  }

  function toggleSort() {
    sortByDate = !sortByDate
    currentPage = 0
    doSearch()
  }
</script>

<div class="search-page">
  <form class="search-form" onsubmit={handleSubmit}>
    <input
      class="search-input"
      type="text"
      placeholder="Search Hacker News..."
      bind:value={inputValue}
      autofocus
    />
    <button class="search-btn" type="submit">Search</button>
  </form>

  {#if searched}
    <div class="search-controls">
      <button class="sort-toggle" class:active={sortByDate} onclick={toggleSort}>
        {sortByDate ? 'By date' : 'By relevance'}
      </button>
    </div>
  {/if}

  <div class="results">
    {#if loading}
      {#each Array(10) as _}
        <StoryCardSkeleton />
      {/each}
    {:else if results.length > 0}
      {#each results as item, i}
        <StoryCard {item} index={i} selected={i === kb.selectedIndex} />
      {/each}
      <div class="pagination">
        <button onclick={prevPage} disabled={currentPage === 0}>← Prev</button>
        <span class="page-info">Page {currentPage + 1} of {totalPages}</span>
        <button onclick={nextPage} disabled={currentPage >= totalPages - 1}>Next →</button>
      </div>
    {:else if searched}
      <p class="no-results">No results for "{query}"</p>
    {/if}
  </div>
</div>

<style>
  .search-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .search-form {
    display: flex;
    gap: 8px;
  }

  .search-input {
    flex: 1;
    padding: 8px 12px;
    font-size: 0.9rem;
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
    padding: 8px 16px;
    font-size: 0.85rem;
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
  }

  .sort-toggle {
    font-size: 0.8rem;
    color: var(--color-text-faint);
    padding: 4px 8px;
    border: 1px solid var(--color-border);
  }

  .sort-toggle.active {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .sort-toggle:hover {
    color: var(--color-text);
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 16px 0;
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
