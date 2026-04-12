<script lang="ts">
  import type { Collection } from '@omnifeed/core'

  let {
    collections,
    itemCollections,
    onselect,
    onclose,
  }: {
    collections: Collection[]
    itemCollections: Collection[]
    onselect: (collectionId: string) => void
    onclose: () => void
  } = $props()

  let memberIds = $derived(new Set(itemCollections.map((c) => c.id)))
</script>

<div class="picker-backdrop" onclick={(e) => { e.preventDefault(); e.stopPropagation(); onclose(); }} role="presentation"></div>
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="picker" onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
  {#each collections as col (col.id)}
    <button
      class="picker-item"
      class:active={memberIds.has(col.id)}
      onclick={(e) => { e.preventDefault(); e.stopPropagation(); onselect(col.id); }}
    >
      <div class="color-dot" style="background: {col.color}"></div>
      <span>{col.name}</span>
      {#if memberIds.has(col.id)}
        <span class="check">*</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
  }

  .picker {
    position: absolute;
    right: 0;
    top: 100%;
    z-index: 201;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    min-width: 160px;
    padding: 2px;
  }

  .picker-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 4px 8px;
    font-size: 0.85rem;
    text-align: left;
  }

  .picker-item:hover {
    background: var(--color-surface-hover);
  }

  .picker-item.active {
    color: var(--color-accent);
  }

  .color-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
  }

  .check {
    margin-left: auto;
    font-size: 0.75rem;
  }
</style>
