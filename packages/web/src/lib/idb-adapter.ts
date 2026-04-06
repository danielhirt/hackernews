import { openDB, type IDBPDatabase } from 'idb'
import type { StorageAdapter, Collection } from '@hackernews/core'
import { DEFAULT_COLLECTION_ID, COLLECTION_COLORS } from '@hackernews/core'

const DB_VERSION = 1
const STORE_NAME = 'collections'

export class IdbStorageAdapter implements StorageAdapter {
  private db!: IDBPDatabase

  constructor(private dbName: string = 'hn-reader') {}

  async init(): Promise<void> {
    this.db = await openDB(this.dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      },
    })

    const existing = await this.getCollection(DEFAULT_COLLECTION_ID)
    if (!existing) {
      await this.saveCollection({
        id: DEFAULT_COLLECTION_ID,
        name: 'Saved',
        color: COLLECTION_COLORS[5],
        itemIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }

  async getCollections(): Promise<Collection[]> {
    return this.db.getAll(STORE_NAME)
  }

  async getCollection(id: string): Promise<Collection | null> {
    return (await this.db.get(STORE_NAME, id)) ?? null
  }

  async saveCollection(collection: Collection): Promise<void> {
    await this.db.put(STORE_NAME, collection)
  }

  async deleteCollection(id: string): Promise<void> {
    await this.db.delete(STORE_NAME, id)
  }

  async addToCollection(collectionId: string, itemId: number): Promise<void> {
    const col = await this.getCollection(collectionId)
    if (!col) return
    if (!col.itemIds.includes(itemId)) {
      col.itemIds.push(itemId)
      col.updatedAt = Date.now()
      await this.saveCollection(col)
    }
  }

  async removeFromCollection(collectionId: string, itemId: number): Promise<void> {
    const col = await this.getCollection(collectionId)
    if (!col) return
    col.itemIds = col.itemIds.filter((id) => id !== itemId)
    col.updatedAt = Date.now()
    await this.saveCollection(col)
  }

  async getCollectionsForItem(itemId: number): Promise<Collection[]> {
    const all = await this.getCollections()
    return all.filter((c) => c.itemIds.includes(itemId))
  }
}
