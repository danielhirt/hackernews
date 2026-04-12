<script lang="ts">
  import { page } from '$app/state'
  import {
    HnClient, LobstersClient, DevtoClient,
    type Story, type FeedItem, type ContentSource,
    storyToFeedItem, parseItemId, SOURCE_ID, SOURCES,
    DEFAULT_COLLECTION_ID,
  } from '@omnifeed/core'
  import { getCollections, removeFromCollection, renameCollection } from '$lib/collections.svelte'
  import StoryCard from '../../../components/StoryCard.svelte'

  const hnClient = new HnClient()
  const lobstersClient = new LobstersClient(undefined, '/api/lobsters?path=')
  const devtoClient = new DevtoClient()
  const cols = getCollections()

  type SortMode = 'saved' | 'newest' | 'oldest' | 'points' | 'discussed'

  let items: FeedItem[] = $state([])
  let loading = $state(true)
  let searchQuery = $state('')
  let sortMode: SortMode = $state('saved')
  let sourceFilter: ContentSource | 'all' = $state('all')

  let collectionId = $derived(page.params.id)
  let collection = $derived(cols.value.find((c) => c.id === collectionId))

  let availableSources = $derived.by(() => {
    const sources = new Set(items.map((i) => i.source))
    return SOURCES.filter((s) => sources.has(s.id))
  })

  let filteredItems = $derived.by(() => {
    let result = items
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((i) =>
        i.title.toLowerCase().includes(q) || i.author.toLowerCase().includes(q)
      )
    }
    if (sourceFilter !== 'all') {
      result = result.filter((i) => i.source === sourceFilter)
    }
    if (sortMode === 'saved') return result
    const sorted = [...result]
    switch (sortMode) {
      case 'newest': sorted.sort((a, b) => b.timestamp - a.timestamp); break
      case 'oldest': sorted.sort((a, b) => a.timestamp - b.timestamp); break
      case 'points': sorted.sort((a, b) => b.score - a.score); break
      case 'discussed': sorted.sort((a, b) => b.commentCount - a.commentCount); break
    }
    return sorted
  })

  let loadedIds: string[] = $state([])

  $effect(() => {
    if (collection) {
      const ids = collection.itemIds
      const idsKey = ids.join(',')
      const loadedKey = loadedIds.join(',')
      if (idsKey !== loadedKey) {
        // Check if items were only removed (subset of loaded)
        const loadedSet = new Set(loadedIds)
        const onlyRemoved = ids.length < loadedIds.length && ids.every((id) => loadedSet.has(id))
        if (onlyRemoved && items.length > 0) {
          // Filter locally instead of re-fetching
          const remaining = new Set(ids)
          items = items.filter((i) => remaining.has(i.id))
          loadedIds = ids
        } else {
          loadItems(ids)
        }
      }
    }
  })

  async function loadItems(ids: string[]) {
    loading = true

    const hnIds: number[] = []
    const loIds: string[] = []
    const devIds: number[] = []

    for (const id of ids) {
      const { source, id: nativeId } = parseItemId(id)
      if (source === SOURCE_ID.HN) hnIds.push(Number(nativeId))
      else if (source === SOURCE_ID.LOBSTERS) loIds.push(nativeId)
      else if (source === SOURCE_ID.DEVTO) devIds.push(Number(nativeId))
    }

    const [hnItems, loItems, devItems] = await Promise.all([
      fetchHnItems(hnIds),
      fetchLobstersItems(loIds),
      fetchDevtoItems(devIds),
    ])

    // Preserve the saved order from collection.itemIds
    const itemMap = new Map<string, FeedItem>()
    for (const item of [...hnItems, ...loItems, ...devItems]) {
      itemMap.set(item.id, item)
    }
    items = ids.map((id) => itemMap.get(id)).filter((item): item is FeedItem => !!item)
    loadedIds = ids
    loading = false
  }

  async function fetchHnItems(ids: number[]): Promise<FeedItem[]> {
    if (ids.length === 0) return []
    const results = await Promise.all(ids.map((id) => hnClient.fetchItem(id).catch(() => null)))
    return results
      .filter((item): item is Story => item !== null && 'title' in item)
      .map(storyToFeedItem)
  }

  async function fetchLobstersItems(shortIds: string[]): Promise<FeedItem[]> {
    if (shortIds.length === 0) return []
    const results = await Promise.all(
      shortIds.map((id) => lobstersClient.fetchStory(id).then((r) => r.story).catch(() => null))
    )
    return results.filter((item): item is FeedItem => item !== null)
  }

  async function fetchDevtoItems(ids: number[]): Promise<FeedItem[]> {
    if (ids.length === 0) return []
    const results = await Promise.all(
      ids.map((id) => devtoClient.fetchArticle(id).catch(() => null))
    )
    return results.filter((item): item is FeedItem => item !== null)
  }

  let editing = $state(false)
  let editName = $state('')

  function startEdit() {
    if (!collection) return
    editName = collection.name
    editing = true
  }

  async function finishEdit() {
    if (editName.trim() && collection) {
      await renameCollection(collection.id, editName.trim())
    }
    editing = false
  }

  async function handleRemove(itemId: string) {
    await removeFromCollection(collectionId!, itemId)
  }
</script>

{#if collection}
  <div class="collection-view">
    <a href="/collections" class="back-link">← Back</a>
    <div class="header">
      <div class="controls-left">
        <div class="color-dot" style="background: {collection.color}"></div>
        {#if editing}
          <input
            type="text"
            class="edit-name"
            bind:value={editName}
            onkeydown={(e) => { if (e.key === 'Enter') finishEdit(); if (e.key === 'Escape') editing = false; }}
          />
          <button class="action-icon" onclick={finishEdit} title="Save">✓</button>
          <button class="action-icon" onclick={() => editing = false} title="Cancel">✕</button>
        {:else}
          <h1>{collection.name}</h1>
          {#if collection.id !== DEFAULT_COLLECTION_ID}
            <button class="rename-icon" onclick={startEdit} title="Rename">✎</button>
          {/if}
        {/if}
        <span class="count">{collection.itemIds.length}</span>
        {#if !loading && items.length > 0}
          <input
            type="text"
            class="search-input"
            placeholder="Search..."
            bind:value={searchQuery}
          />
        {/if}
      </div>
      {#if !loading && items.length > 0}
        <div class="controls-right">
          <button class="control-btn" class:active={sortMode === 'saved'} onclick={() => sortMode = 'saved'}>Saved</button>
          <button class="control-btn" class:active={sortMode === 'newest'} onclick={() => sortMode = 'newest'}>Newest</button>
          <button class="control-btn" class:active={sortMode === 'oldest'} onclick={() => sortMode = 'oldest'}>Oldest</button>
          <button class="control-btn" class:active={sortMode === 'points'} onclick={() => sortMode = 'points'}>Points</button>
          <button class="control-btn" class:active={sortMode === 'discussed'} onclick={() => sortMode = 'discussed'}>Discussed</button>
          {#if availableSources.length > 1}
            <span class="controls-sep">|</span>
            <button class="control-btn" class:active={sourceFilter === 'all'} onclick={() => sourceFilter = 'all'}>All</button>
            {#each availableSources as src}
              <button class="control-btn" class:active={sourceFilter === src.id} onclick={() => sourceFilter = src.id}>{src.shortName}</button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>

    {#if loading}
      <p class="loading">Loading...</p>
    {:else if items.length === 0}
      <p class="empty">Empty.</p>
    {:else if filteredItems.length === 0}
      <p class="empty">No items match "{searchQuery.trim()}"</p>
    {:else}
      {#each filteredItems as item, i (item.id)}
        <div class="saved-story">
          <StoryCard {item} index={i} showSourceBadge={availableSources.length > 1} />
          <button class="remove-btn" onclick={() => handleRemove(item.id)} title="Remove from collection">✕</button>
        </div>
      {/each}
    {/if}
  </div>
{:else}
  <p class="not-found">Not found.</p>
{/if}

<style>
  .collection-view {
    display: flex;
    flex-direction: column;
  }

  .back-link {
    font-size: 0.8rem;
    color: var(--color-text-faint);
    text-decoration: none;
    margin-bottom: 8px;
  }

  .back-link:hover {
    color: var(--color-accent);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 8px;
  }

  .controls-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .controls-right {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .color-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
  }

  h1 {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .count {
    font-size: 0.8rem;
    color: var(--color-text-faint);
  }

  .rename-icon {
    font-size: 0.85rem;
    color: var(--color-text-faint);
    line-height: 1;
    padding: 0 2px;
  }

  .rename-icon:hover {
    color: var(--color-accent);
  }

  .edit-name {
    padding: 2px 8px;
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    font-family: inherit;
    font-size: 1rem;
    font-weight: 600;
    width: 180px;
  }

  .action-btn {
    font-size: 0.75rem;
    color: var(--color-text-faint);
    padding: 2px 6px;
  }

  .action-btn:hover {
    color: var(--color-text-muted);
  }

  .search-input {
    padding: 3px 8px;
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    font-family: inherit;
    font-size: 0.75rem;
    width: 120px;
    margin-left: 4px;
  }

  .search-input::placeholder {
    color: var(--color-text-faint);
  }

  .search-input:focus {
    border-color: var(--color-text-faint);
    outline: none;
  }

  .controls-sep {
    color: var(--color-border);
    font-size: 0.75rem;
    margin: 0 2px;
  }

  .control-btn {
    font-size: 0.75rem;
    color: var(--color-text-faint);
    padding: 2px 5px;
    border: 1px solid transparent;
  }

  .control-btn:hover {
    color: var(--color-text);
  }

  .control-btn.active {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .loading,
  .empty,
  .not-found {
    color: var(--color-text-muted);
    padding: 16px 0;
  }

  .saved-story {
    position: relative;
  }

  .remove-btn {
    position: absolute;
    right: -24px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.7rem;
    color: var(--color-text-faint);
    opacity: 0;
    padding: 4px;
    transition: opacity 0.15s;
  }

  .saved-story:hover .remove-btn {
    opacity: 1;
  }

  .remove-btn:hover {
    color: var(--color-danger);
  }
</style>
