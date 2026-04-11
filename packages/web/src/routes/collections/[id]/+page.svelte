<script lang="ts">
  import { page } from '$app/state'
  import {
    HnClient, LobstersClient, DevtoClient,
    type Story, type FeedItem,
    storyToFeedItem, parseItemId, SOURCE_ID,
  } from '@hackernews/core'
  import { getCollections, removeFromCollection } from '$lib/collections.svelte'
  import StoryCard from '../../../components/StoryCard.svelte'

  const hnClient = new HnClient()
  const lobstersClient = new LobstersClient(undefined, '/api/lobsters?path=')
  const devtoClient = new DevtoClient()
  const cols = getCollections()

  let items: FeedItem[] = $state([])
  let loading = $state(true)

  let collectionId = $derived(page.params.id)
  let collection = $derived(cols.value.find((c) => c.id === collectionId))

  $effect(() => {
    if (collection) {
      loadItems(collection.itemIds)
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

  async function handleRemove(itemId: string) {
    await removeFromCollection(collectionId, itemId)
  }
</script>

{#if collection}
  <div class="collection-view">
    <div class="header">
      <div class="color-dot" style="background: {collection.color}"></div>
      <h1>{collection.name}</h1>
      <span class="count">{collection.itemIds.length}</span>
    </div>

    {#if loading}
      <p class="loading">Loading...</p>
    {:else if items.length === 0}
      <p class="empty">Empty.</p>
    {:else}
      {#each items as item, i (item.id)}
        <div class="saved-story">
          <StoryCard {item} index={i} showSourceBadge={true} />
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

  .header {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 8px;
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
