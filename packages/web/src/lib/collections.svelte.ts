import { browser } from '$app/environment'
import type { Collection } from '@hackernews/core'
import { COLLECTION_COLORS, DEFAULT_COLLECTION_ID } from '@hackernews/core'
import { IdbStorageAdapter } from './idb-adapter'

let adapter: IdbStorageAdapter | null = null
let initialized = false

let collections = $state<Collection[]>([])

async function ensureInit() {
  if (!browser) return
  if (!initialized) {
    adapter = new IdbStorageAdapter()
    await adapter.init()
    initialized = true
    await refresh()
  }
}

async function refresh() {
  if (!adapter) return
  collections = await adapter.getCollections()
}

export function getCollections() {
  ensureInit()
  return {
    get value() { return collections },
  }
}

export async function createCollection(name: string, color: string): Promise<void> {
  await ensureInit()
  if (!adapter) return
  const id = crypto.randomUUID()
  await adapter.saveCollection({
    id,
    name,
    color,
    itemIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
  await refresh()
}

export async function deleteCollection(id: string): Promise<void> {
  if (id === DEFAULT_COLLECTION_ID) return
  await ensureInit()
  if (!adapter) return
  await adapter.deleteCollection(id)
  await refresh()
}

export async function renameCollection(id: string, name: string): Promise<void> {
  await ensureInit()
  if (!adapter) return
  const col = await adapter.getCollection(id)
  if (!col) return
  col.name = name
  col.updatedAt = Date.now()
  await adapter.saveCollection(col)
  await refresh()
}

export async function updateCollectionColor(id: string, color: string): Promise<void> {
  await ensureInit()
  if (!adapter) return
  const col = await adapter.getCollection(id)
  if (!col) return
  col.color = color
  col.updatedAt = Date.now()
  await adapter.saveCollection(col)
  await refresh()
}

export async function addToCollection(collectionId: string, itemId: string): Promise<void> {
  await ensureInit()
  if (!adapter) return
  await adapter.addToCollection(collectionId, itemId)
  await refresh()
}

export async function removeFromCollection(collectionId: string, itemId: string): Promise<void> {
  await ensureInit()
  if (!adapter) return
  await adapter.removeFromCollection(collectionId, itemId)
  await refresh()
}

export async function getCollectionsForItem(itemId: string): Promise<Collection[]> {
  await ensureInit()
  if (!adapter) return []
  return adapter.getCollectionsForItem(itemId)
}

export { COLLECTION_COLORS }
