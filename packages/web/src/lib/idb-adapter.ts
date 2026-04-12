import { openDB, type IDBPDatabase } from 'idb'
import type { StorageAdapter, Collection } from '@omnifeed/core'
import { DEFAULT_COLLECTION_ID, COLLECTION_COLORS } from '@omnifeed/core'

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

    // Migrate numeric itemIds to source-prefixed string format
    const allCols = await this.db.getAll(STORE_NAME)
    for (const col of allCols) {
      if (col.itemIds?.some((id: unknown) => typeof id === 'number')) {
        col.itemIds = col.itemIds.map((id: unknown) =>
          typeof id === 'number' ? `hn:${id}` : String(id)
        )
        await this.db.put(STORE_NAME, col)
      }
    }

    // Migrate old 'saved' collection to 'favorites'
    const old = await this.db.get(STORE_NAME, 'saved')
    if (old) {
      await this.db.delete(STORE_NAME, 'saved')
      old.id = DEFAULT_COLLECTION_ID
      old.name = 'Favorites'
      old.color = COLLECTION_COLORS[2]
      await this.saveCollection(old)
    }

    const existing = await this.getCollection(DEFAULT_COLLECTION_ID)
    if (!existing) {
      await this.saveCollection({
        id: DEFAULT_COLLECTION_ID,
        name: 'Favorites',
        color: COLLECTION_COLORS[2],
        itemIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    } else if (existing.name !== 'Favorites' || existing.color !== COLLECTION_COLORS[2]) {
      existing.name = 'Favorites'
      existing.color = COLLECTION_COLORS[2]
      await this.saveCollection(existing)
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

  async addToCollection(collectionId: string, itemId: string): Promise<void> {
    const col = await this.getCollection(collectionId)
    if (!col) return
    if (!col.itemIds.includes(itemId)) {
      col.itemIds.push(itemId)
      col.updatedAt = Date.now()
      await this.saveCollection(col)
    }
  }

  async removeFromCollection(collectionId: string, itemId: string): Promise<void> {
    const col = await this.getCollection(collectionId)
    if (!col) return
    col.itemIds = col.itemIds.filter((id) => id !== itemId)
    col.updatedAt = Date.now()
    await this.saveCollection(col)
  }

  async getCollectionsForItem(itemId: string): Promise<Collection[]> {
    const all = await this.getCollections()
    return all.filter((c) => c.itemIds.includes(itemId))
  }
}
