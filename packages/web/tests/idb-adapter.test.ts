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

  it('renames a collection via saveCollection', async () => {
    const col = await adapter.getCollection(DEFAULT_COLLECTION_ID)
    expect(col).not.toBeNull()
    col!.name = 'Bookmarks'
    col!.updatedAt = Date.now()
    await adapter.saveCollection(col!)
    const updated = await adapter.getCollection(DEFAULT_COLLECTION_ID)
    expect(updated!.name).toBe('Bookmarks')
  })

  it('preserves itemIds when renaming', async () => {
    await adapter.addToCollection(DEFAULT_COLLECTION_ID, 'hn:1')
    await adapter.addToCollection(DEFAULT_COLLECTION_ID, 'lo:abc')
    const col = await adapter.getCollection(DEFAULT_COLLECTION_ID)
    col!.name = 'Renamed'
    await adapter.saveCollection(col!)
    const updated = await adapter.getCollection(DEFAULT_COLLECTION_ID)
    expect(updated!.itemIds).toContain('hn:1')
    expect(updated!.itemIds).toContain('lo:abc')
    expect(updated!.name).toBe('Renamed')
  })

  it('adds string-prefixed item IDs to collection', async () => {
    await adapter.addToCollection(DEFAULT_COLLECTION_ID, 'hn:100')
    await adapter.addToCollection(DEFAULT_COLLECTION_ID, 'dev:200')
    const col = await adapter.getCollection(DEFAULT_COLLECTION_ID)
    expect(col!.itemIds).toContain('hn:100')
    expect(col!.itemIds).toContain('dev:200')
  })

  it('removes string-prefixed item IDs from collection', async () => {
    await adapter.addToCollection(DEFAULT_COLLECTION_ID, 'lo:xyz')
    await adapter.removeFromCollection(DEFAULT_COLLECTION_ID, 'lo:xyz')
    const col = await adapter.getCollection(DEFAULT_COLLECTION_ID)
    expect(col!.itemIds).not.toContain('lo:xyz')
  })

  it('updates collection color via saveCollection', async () => {
    const col = await adapter.getCollection(DEFAULT_COLLECTION_ID)
    col!.color = '#3b82f6'
    await adapter.saveCollection(col!)
    const updated = await adapter.getCollection(DEFAULT_COLLECTION_ID)
    expect(updated!.color).toBe('#3b82f6')
  })
})
