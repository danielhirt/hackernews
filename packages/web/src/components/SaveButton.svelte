<script lang="ts">
  import { DEFAULT_COLLECTION_ID } from '@omnifeed/core'
  import {
    getCollections,
    addToCollection,
    removeFromCollection,
  } from '$lib/collections.svelte'
  import CollectionPicker from './CollectionPicker.svelte'

  let { itemId }: { itemId: string } = $props()

  const cols = getCollections()

  let showPicker = $state(false)
  let itemCollections = $derived(
    cols.value.filter((c) => c.itemIds.includes(itemId))
  )
  let saved = $derived(itemCollections.length > 0)
  let iconColor = $derived(() => {
    if (!saved) return ''
    const custom = itemCollections.find((c) => c.id !== DEFAULT_COLLECTION_ID)
    if (custom) return custom.color
    return itemCollections[0]?.color ?? ''
  })

  async function handleClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (cols.value.length <= 1) {
      if (saved) {
        await removeFromCollection(DEFAULT_COLLECTION_ID, itemId)
      } else {
        await addToCollection(DEFAULT_COLLECTION_ID, itemId)
      }
    } else {
      showPicker = !showPicker
    }
  }

  async function handleSelect(collectionId: string) {
    const isMember = itemCollections.some((c) => c.id === collectionId)
    if (isMember) {
      await removeFromCollection(collectionId, itemId)
    } else {
      await addToCollection(collectionId, itemId)
    }
  }
</script>

<div class="save-wrapper">
  <button
    class="save-btn"
    class:saved
    onclick={handleClick}
    title={saved ? 'Saved' : 'Save'}
    style={saved ? `color: ${iconColor()}` : ''}
  >
    {saved ? '●' : '○'}
  </button>
  {#if showPicker}
    <CollectionPicker
      collections={cols.value}
      {itemCollections}
      onselect={handleSelect}
      onclose={() => (showPicker = false)}
    />
  {/if}
</div>

<style>
  .save-wrapper {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }

  .save-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    width: 28px;
    height: 28px;
    color: var(--color-text-faint);
  }

  .save-btn:hover {
    color: var(--color-accent);
  }



</style>
