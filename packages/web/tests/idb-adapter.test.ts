import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { IdbStorageAdapter } from '../src/lib/idb-adapter'
import { DEFAULT_COLLECTION_ID } from '@hackernews/core'

describe('IdbStorageAdapter', () => {
  let adapter: IdbStorageAdapter

  beforeEach(async () => {
    adapter = new IdbStorageAdapter(`test-${Date.now()}-${Math.random()}`)
    await adapter.init()
  })

  it('initializes with default Saved collection', async () => {
    const collections = await adapter.getCollections()
    expect(collections).toHaveLength(1)
    expect(collections[0].id).toBe(DEFAULT_COLLECTION_ID)
  })

  it('creates and retrieves a collection', async () => {
    await adapter.saveCollection({
      id: 'test',
      name: 'Test',
      color: '#ef4444',
      itemIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const result = await adapter.getCollection('test')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test')
  })

  it('adds item to collection', async () => {
    await adapter.addToCollection(DEFAULT_COLLECTION_ID, 123)
    const col = await adapter.getCollection(DEFAULT_COLLECTION_ID)
    expect(col!.itemIds).toContain(123)
  })

  it('removes item from collection', async () => {
    await adapter.addToCollection(DEFAULT_COLLECTION_ID, 123)
    await adapter.removeFromCollection(DEFAULT_COLLECTION_ID, 123)
    const col = await adapter.getCollection(DEFAULT_COLLECTION_ID)
    expect(col!.itemIds).not.toContain(123)
  })

  it('deletes a collection', async () => {
    await adapter.saveCollection({
      id: 'temp',
      name: 'Temp',
      color: '#22c55e',
      itemIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await adapter.deleteCollection('temp')
    expect(await adapter.getCollection('temp')).toBeNull()
  })

  it('finds collections containing an item', async () => {
    await adapter.addToCollection(DEFAULT_COLLECTION_ID, 42)
    await adapter.saveCollection({
      id: 'other',
      name: 'Other',
      color: '#8b5cf6',
      itemIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await adapter.addToCollection('other', 42)
    const cols = await adapter.getCollectionsForItem(42)
    expect(cols).toHaveLength(2)
  })
})
