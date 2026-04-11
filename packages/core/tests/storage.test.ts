import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryStorageAdapter } from '../src/storage.js'
import { DEFAULT_COLLECTION_ID } from '../src/models.js'

describe('InMemoryStorageAdapter', () => {
  let storage: InMemoryStorageAdapter

  beforeEach(() => {
    storage = new InMemoryStorageAdapter()
  })

  it('has a default "Saved" collection', async () => {
    const collections = await storage.getCollections()
    expect(collections).toHaveLength(1)
    expect(collections[0].id).toBe(DEFAULT_COLLECTION_ID)
    expect(collections[0].name).toBe('Favorites')
  })

  it('creates a new collection', async () => {
    await storage.saveCollection({
      id: 'test',
      name: 'Test',
      color: '#ef4444',
      itemIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    const collections = await storage.getCollections()
    expect(collections).toHaveLength(2)
  })

  it('gets a collection by id', async () => {
    const result = await storage.getCollection(DEFAULT_COLLECTION_ID)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Favorites')
  })

  it('returns null for missing collection', async () => {
    const result = await storage.getCollection('nonexistent')
    expect(result).toBeNull()
  })

  it('adds an item to a collection', async () => {
    await storage.addToCollection(DEFAULT_COLLECTION_ID, 'hn:12345')
    const collection = await storage.getCollection(DEFAULT_COLLECTION_ID)
    expect(collection!.itemIds).toContain('hn:12345')
  })

  it('does not duplicate items in a collection', async () => {
    await storage.addToCollection(DEFAULT_COLLECTION_ID, 'hn:12345')
    await storage.addToCollection(DEFAULT_COLLECTION_ID, 'hn:12345')
    const collection = await storage.getCollection(DEFAULT_COLLECTION_ID)
    expect(collection!.itemIds.filter((id) => id === 'hn:12345')).toHaveLength(1)
  })

  it('removes an item from a collection', async () => {
    await storage.addToCollection(DEFAULT_COLLECTION_ID, 'hn:12345')
    await storage.removeFromCollection(DEFAULT_COLLECTION_ID, 'hn:12345')
    const collection = await storage.getCollection(DEFAULT_COLLECTION_ID)
    expect(collection!.itemIds).not.toContain('hn:12345')
  })

  it('deletes a collection', async () => {
    await storage.saveCollection({
      id: 'temp',
      name: 'Temp',
      color: '#3b82f6',
      itemIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await storage.deleteCollection('temp')
    const result = await storage.getCollection('temp')
    expect(result).toBeNull()
  })

  it('finds collections containing an item', async () => {
    await storage.addToCollection(DEFAULT_COLLECTION_ID, 'hn:42')
    await storage.saveCollection({
      id: 'other',
      name: 'Other',
      color: '#22c55e',
      itemIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await storage.addToCollection('other', 'hn:42')

    const collections = await storage.getCollectionsForItem('hn:42')
    expect(collections).toHaveLength(2)
  })
})
