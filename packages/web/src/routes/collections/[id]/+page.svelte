<script lang="ts">
  import { page } from '$app/state'
  import { HnClient, type Story, type FeedItem, storyToFeedItem } from '@hackernews/core'
  import { getCollections, removeFromCollection } from '$lib/collections.svelte'
  import StoryCard from '../../../components/StoryCard.svelte'

  const client = new HnClient()
  const cols = getCollections()

  let items: FeedItem[] = $state([])
  let loading = $state(true)

  let collectionId = $derived(page.params.id)
  let collection = $derived(cols.value.find((c) => c.id === collectionId))

  $effect(() => {
    if (collection) {
      loadStories(collection.itemIds)
    }
  })

  async function loadStories(ids: string[]) {
    loading = true
    const numericIds = ids
      .filter((id) => id.startsWith('hn:'))
      .map((id) => Number(id.slice(3)))
    const results = await Promise.all(
      numericIds.map((id) => client.fetchItem(id))
    )
    items = results
      .filter((item): item is Story => item !== null && 'title' in item)
      .map(storyToFeedItem)
    loading = false
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
          <StoryCard {item} index={i} />
          <button class="remove-btn" onclick={() => handleRemove(item.id)}>[x]</button>
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
    display: flex;
    align-items: center;
  }

  .saved-story :global(.story-card) {
    flex: 1;
  }

  .remove-btn {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--color-text-faint);
    padding: 2px 6px;
    flex-shrink: 0;
  }

  .remove-btn:hover {
    color: var(--color-danger);
  }
</style>
