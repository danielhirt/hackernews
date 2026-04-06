<script lang="ts">
  import { COLLECTION_COLORS, DEFAULT_COLLECTION_ID } from '@hackernews/core'
  import {
    getCollections,
    createCollection,
    deleteCollection,
    renameCollection,
    updateCollectionColor,
  } from '$lib/collections.svelte'

  const cols = getCollections()

  let showCreate = $state(false)
  let newName = $state('')
  let newColor = $state(COLLECTION_COLORS[0])
  let editingId: string | null = $state(null)
  let editName = $state('')
  let confirmDeleteId: string | null = $state(null)

  async function handleCreate() {
    if (!newName.trim()) return
    await createCollection(newName.trim(), newColor)
    newName = ''
    newColor = COLLECTION_COLORS[0]
    showCreate = false
  }

  async function handleDelete(id: string) {
    await deleteCollection(id)
    confirmDeleteId = null
  }

  function startEdit(id: string, name: string) {
    editingId = id
    editName = name
  }

  async function finishEdit(id: string) {
    if (editName.trim()) {
      await renameCollection(id, editName.trim())
    }
    editingId = null
  }
</script>

<div class="collections-page">
  <div class="header">
    <h1>Collections</h1>
    <button class="create-btn" onclick={() => (showCreate = !showCreate)}>
      {showCreate ? 'cancel' : '+ new'}
    </button>
  </div>

  {#if showCreate}
    <form class="create-form" onsubmit={(e) => { e.preventDefault(); handleCreate() }}>
      <input
        type="text"
        bind:value={newName}
        placeholder="name"
        class="name-input"
      />
      <div class="color-picker">
        {#each COLLECTION_COLORS as color}
          <button
            type="button"
            class="color-swatch"
            class:selected={newColor === color}
            style="background: {color}"
            onclick={() => (newColor = color)}
            aria-label="Color {color}"
          ></button>
        {/each}
      </div>
      <button type="submit" class="submit-btn">create</button>
    </form>
  {/if}

  <div class="collection-list">
    {#each cols.value as col (col.id)}
      <div class="collection-item">
        <div class="color-dot" style="background: {col.color}"></div>
        <div class="collection-info">
          {#if editingId === col.id}
            <input
              type="text"
              bind:value={editName}
              class="edit-input"
              onkeydown={(e) => { if (e.key === 'Enter') finishEdit(col.id); if (e.key === 'Escape') editingId = null; }}
            />
            <button class="action-btn" onclick={() => finishEdit(col.id)}>save</button>
          {:else}
            <a href="/collections/{col.id}" class="collection-name">{col.name}</a>
            <span class="item-count">{col.itemIds.length}</span>
          {/if}
        </div>
        <div class="collection-actions">
          {#if col.id !== DEFAULT_COLLECTION_ID}
            <button class="action-btn" onclick={() => startEdit(col.id, col.name)}>rename</button>
            {#if confirmDeleteId === col.id}
              <button class="action-btn danger" onclick={() => handleDelete(col.id)}>confirm</button>
              <button class="action-btn" onclick={() => (confirmDeleteId = null)}>cancel</button>
            {:else}
              <button class="action-btn" onclick={() => (confirmDeleteId = col.id)}>delete</button>
            {/if}
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .collections-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .create-btn {
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .create-btn:hover {
    color: var(--color-text);
    border-color: var(--color-text-faint);
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--color-border);
  }

  .name-input,
  .edit-input {
    padding: 4px 8px;
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    font-family: inherit;
    font-size: 0.85rem;
  }

  .color-picker {
    display: flex;
    gap: 4px;
  }

  .color-swatch {
    width: 20px;
    height: 20px;
    border: 1px solid transparent;
  }

  .color-swatch.selected {
    border-color: var(--color-text);
  }

  .submit-btn {
    align-self: flex-start;
    padding: 4px 12px;
    border: 1px solid var(--color-border);
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .submit-btn:hover {
    color: var(--color-text);
  }

  .collection-list {
    display: flex;
    flex-direction: column;
  }

  .collection-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .color-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
  }

  .collection-info {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .collection-name {
    color: var(--color-text);
    text-decoration: none;
  }

  .collection-name:hover {
    color: var(--color-accent);
  }

  .item-count {
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }

  .collection-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    font-size: 0.75rem;
    color: var(--color-text-faint);
    padding: 2px 6px;
  }

  .action-btn:hover {
    color: var(--color-text-muted);
  }

  .action-btn.danger {
    color: var(--color-danger);
  }

  .edit-input {
    width: 180px;
  }
</style>
