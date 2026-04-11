import type { Collection } from './models.js'
import { DEFAULT_COLLECTION_ID, COLLECTION_COLORS } from './models.js'

export interface StorageAdapter {
  getCollections(): Promise<Collection[]>
  getCollection(id: string): Promise<Collection | null>
  saveCollection(collection: Collection): Promise<void>
  deleteCollection(id: string): Promise<void>
  addToCollection(collectionId: string, itemId: string): Promise<void>
  removeFromCollection(collectionId: string, itemId: string): Promise<void>
  getCollectionsForItem(itemId: string): Promise<Collection[]>
}

function createDefaultCollection(): Collection {
  return {
    id: DEFAULT_COLLECTION_ID,
    name: 'Favorites',
    color: COLLECTION_COLORS[2], // yellow
    itemIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private collections = new Map<string, Collection>()

  constructor() {
    const defaultCol = createDefaultCollection()
    this.collections.set(defaultCol.id, defaultCol)
  }

  async getCollections(): Promise<Collection[]> {
    return [...this.collections.values()]
  }

  async getCollection(id: string): Promise<Collection | null> {
    return this.collections.get(id) ?? null
  }

  async saveCollection(collection: Collection): Promise<void> {
    this.collections.set(collection.id, { ...collection })
  }

  async deleteCollection(id: string): Promise<void> {
    this.collections.delete(id)
  }

  async addToCollection(collectionId: string, itemId: string): Promise<void> {
    const collection = this.collections.get(collectionId)
    if (!collection) return
    if (!collection.itemIds.includes(itemId)) {
      collection.itemIds.push(itemId)
      collection.updatedAt = Date.now()
    }
  }

  async removeFromCollection(collectionId: string, itemId: string): Promise<void> {
    const collection = this.collections.get(collectionId)
    if (!collection) return
    collection.itemIds = collection.itemIds.filter((id) => id !== itemId)
    collection.updatedAt = Date.now()
  }

  async getCollectionsForItem(itemId: string): Promise<Collection[]> {
    return [...this.collections.values()].filter((c) => c.itemIds.includes(itemId))
  }
}
