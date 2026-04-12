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

  type SortMode = 'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'most' | 'fewest'

  let showCreate = $state(false)
  let newName = $state('')
  let newColor = $state(COLLECTION_COLORS[0])
  let editingId: string | null = $state(null)
  let editName = $state('')
  let confirmDeleteId: string | null = $state(null)
  let colorPickerId: string | null = $state(null)
  let searchQuery = $state('')
  let sortMode: SortMode = $state('newest')

  let filteredCols = $derived.by(() => {
    let result = cols.value
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((c) => c.name.toLowerCase().includes(q))
    }
    const favorites = result.filter((c) => c.id === DEFAULT_COLLECTION_ID)
    const rest = result.filter((c) => c.id !== DEFAULT_COLLECTION_ID)
    switch (sortMode) {
      case 'name-asc': rest.sort((a, b) => a.name.localeCompare(b.name)); break
      case 'name-desc': rest.sort((a, b) => b.name.localeCompare(a.name)); break
      case 'newest': rest.sort((a, b) => b.createdAt - a.createdAt); break
      case 'oldest': rest.sort((a, b) => a.createdAt - b.createdAt); break
      case 'most': rest.sort((a, b) => b.itemIds.length - a.itemIds.length); break
      case 'fewest': rest.sort((a, b) => a.itemIds.length - b.itemIds.length); break
    }
    return [...favorites, ...rest]
  })

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

  function toggleColorPicker(id: string) {
    colorPickerId = colorPickerId === id ? null : id
  }

  async function setCollectionColor(id: string, color: string) {
    await updateCollectionColor(id, color)
    colorPickerId = null
  }
</script>

<div class="collections-page">
  <div class="header">
    <h1>Collections</h1>
    <button class="create-btn" onclick={() => (showCreate = !showCreate)}>
      {showCreate ? 'Cancel' : '+ New'}
    </button>
  </div>

  {#if showCreate}
    <form class="create-form" onsubmit={(e) => { e.preventDefault(); handleCreate() }}>
      <div class="create-top">
        <input
          type="text"
          bind:value={newName}
          placeholder="Collection name"
          class="name-input"
        />
        <button type="submit" class="submit-btn" disabled={!newName.trim()}>Create</button>
      </div>
      <div class="color-picker">
        {#each COLLECTION_COLORS as color}
          <button
            type="button"
            class="color-swatch"
            class:selected={newColor === color}
            style="background: {color}"
            onclick={() => (newColor = color)}
          ></button>
        {/each}
        <label class="custom-color">
          <input
            type="color"
            value={newColor}
            onchange={(e) => (newColor = (e.target as HTMLInputElement).value)}
          />
        </label>
      </div>
    </form>
  {/if}

  <div class="collection-controls">
    <div class="controls-left">
      <input
        type="text"
        class="search-input"
        placeholder="Search collections..."
        bind:value={searchQuery}
      />
    </div>
    <div class="controls-right">
      <button class="control-btn" class:active={sortMode === 'newest'} onclick={() => sortMode = 'newest'}>Newest</button>
      <button class="control-btn" class:active={sortMode === 'oldest'} onclick={() => sortMode = 'oldest'}>Oldest</button>
      <span class="controls-sep">|</span>
      <button class="control-btn" class:active={sortMode === 'name-asc'} onclick={() => sortMode = 'name-asc'}>A–Z</button>
      <button class="control-btn" class:active={sortMode === 'name-desc'} onclick={() => sortMode = 'name-desc'}>Z–A</button>
      <span class="controls-sep">|</span>
      <button class="control-btn" class:active={sortMode === 'most'} onclick={() => sortMode = 'most'}>Most</button>
      <button class="control-btn" class:active={sortMode === 'fewest'} onclick={() => sortMode = 'fewest'}>Fewest</button>
    </div>
  </div>

  <div class="collection-list">
    {#each filteredCols as col (col.id)}
      <div class="collection-item">
        <button
          class="color-dot"
          style="background: {col.color}"
          title="Change color"
          onclick={() => toggleColorPicker(col.id)}
        ></button>
        <div class="collection-info">
          {#if editingId === col.id}
            <input
              type="text"
              bind:value={editName}
              class="edit-input"
              onkeydown={(e) => { if (e.key === 'Enter') finishEdit(col.id); if (e.key === 'Escape') editingId = null; }}
            />
            <button class="action-btn" onclick={() => finishEdit(col.id)}>Save</button>
          {:else}
            <a href="/collections/{col.id}" class="collection-name">{col.name}</a>
            <span class="item-count">{col.itemIds.length}</span>
          {/if}
        </div>
        <div class="collection-actions">
          {#if col.id !== DEFAULT_COLLECTION_ID}
            {#if confirmDeleteId === col.id}
              <button class="action-btn danger" onclick={() => handleDelete(col.id)}>Confirm</button>
              <button class="action-btn" onclick={() => (confirmDeleteId = null)}>Cancel</button>
            {:else}
              <button class="action-icon" onclick={() => startEdit(col.id, col.name)} title="Rename">✎</button>
              <button class="action-icon action-danger" onclick={() => (confirmDeleteId = col.id)} title="Delete">✕</button>
            {/if}
          {/if}
        </div>
      </div>
      {#if colorPickerId === col.id}
        <div class="inline-color-picker">
          {#each COLLECTION_COLORS as color}
            <button
              class="color-swatch"
              class:selected={col.color === color}
              style="background: {color}"
              onclick={() => setCollectionColor(col.id, color)}
            ></button>
          {/each}
          <label class="custom-color">
            <input
              type="color"
              value={col.color}
              onchange={(e) => setCollectionColor(col.id, (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
      {/if}
    {/each}
    {#if filteredCols.length === 0 && searchQuery.trim()}
      <p class="no-results">No collections match "{searchQuery.trim()}"</p>
    {/if}
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

  .create-top {
    display: flex;
    gap: 8px;
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

  .name-input {
    flex: 1;
  }

  .submit-btn {
    padding: 4px 12px;
    border: 1px solid var(--color-border);
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .submit-btn:hover:not(:disabled) {
    color: var(--color-text);
    border-color: var(--color-text-faint);
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .color-picker,
  .inline-color-picker {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .inline-color-picker {
    padding: 6px 0 6px 18px;
    border-bottom: 1px solid var(--color-border);
  }

  .color-swatch {
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    cursor: pointer;
  }

  .color-swatch:hover {
    opacity: 0.8;
  }

  .color-swatch.selected {
    border-color: var(--color-text);
    outline: 2px solid var(--color-bg);
    outline-offset: -3px;
  }

  .custom-color {
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .custom-color input[type="color"] {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--color-border);
    background: none;
    cursor: pointer;
  }

  .custom-color input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .custom-color input[type="color"]::-webkit-color-swatch {
    border: none;
  }

  .collection-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
  }

  .controls-left {
    display: flex;
    align-items: center;
  }

  .controls-right {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .search-input {
    padding: 3px 8px;
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-border);
    font-family: inherit;
    font-size: 0.75rem;
    width: 160px;
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

  .no-results {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    padding: 12px 0;
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
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    cursor: pointer;
    border: none;
  }

  .color-dot:hover {
    opacity: 0.7;
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
    align-items: center;
    gap: 4px;
  }

  .action-icon {
    font-size: 0.85rem;
    color: var(--color-text-faint);
    padding: 0 2px;
    line-height: 1;
  }

  .action-icon:hover {
    color: var(--color-accent);
  }

  .action-icon.action-danger:hover {
    color: var(--color-danger);
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
