import { describe, it, expect, vi } from 'vitest'
import type { Comment } from '../src/models.js'
import type { HnClient } from '../src/client.js'
import {
  hnCommentToItem,
  fetchHnCommentTree,
  fetchHnCommentBatch,
  fetchHnCommentChildren,
} from '../src/comments.js'

function makeComment(id: number, overrides: Partial<Comment> = {}): Comment {
  return { id, text: `<p>Comment ${id}</p>`, by: 'testuser', time: 1700000000, parent: 1, ...overrides }
}

function makeMockClient(fetchItemImpl: (id: number) => Promise<unknown>): HnClient {
  return { fetchItem: vi.fn(fetchItemImpl) } as unknown as HnClient
}

describe('hnCommentToItem', () => {
  it('converts a Comment to CommentItem with correct field mapping', () => {
    const comment = makeComment(42)
    const item = hnCommentToItem(comment, 0)

    expect(item.id).toBe('hn:42')
    expect(item.source).toBe('hackernews')
    expect(item.text).toBe('<p>Comment 42</p>')
    expect(item.author).toBe('testuser')
    expect(item.timestamp).toBe(1700000000)
    expect(item.children).toEqual([])
    expect(item.depth).toBe(0)
  })

  it('sets depth correctly for nested comments', () => {
    const comment = makeComment(7)
    expect(hnCommentToItem(comment, 3).depth).toBe(3)
  })

  it('maps the deleted flag', () => {
    const comment = makeComment(10, { deleted: true })
    expect(hnCommentToItem(comment, 0).deleted).toBe(true)
  })

  it('maps the dead flag', () => {
    const comment = makeComment(11, { dead: true })
    expect(hnCommentToItem(comment, 0).dead).toBe(true)
  })

  it('leaves deleted/dead undefined when not set', () => {
    const comment = makeComment(12)
    const item = hnCommentToItem(comment, 0)
    expect(item.deleted).toBeUndefined()
    expect(item.dead).toBeUndefined()
  })
})

describe('fetchHnCommentTree', () => {
  it('returns empty array for empty id list', async () => {
    const client = makeMockClient(() => Promise.resolve(null))
    const result = await fetchHnCommentTree(client, [])
    expect(result).toEqual([])
    expect(client.fetchItem).not.toHaveBeenCalled()
  })

  it('fetches a flat list of comments', async () => {
    const comments = [makeComment(1), makeComment(2)]
    const client = makeMockClient((id) =>
      Promise.resolve(comments.find((c) => c.id === id) ?? null),
    )

    const result = await fetchHnCommentTree(client, [1, 2])
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('hn:1')
    expect(result[1].id).toBe('hn:2')
  })

  it('recursively fetches children', async () => {
    const parent = makeComment(1, { kids: [2] })
    const child = makeComment(2, { parent: 1 })
    const map = new Map([[1, parent], [2, child]])
    const client = makeMockClient((id) => Promise.resolve(map.get(id) ?? null))

    const result = await fetchHnCommentTree(client, [1])
    expect(result).toHaveLength(1)
    expect(result[0].children).toHaveLength(1)
    expect(result[0].children[0].id).toBe('hn:2')
    expect(result[0].children[0].depth).toBe(1)
  })

  it('skips deleted comments', async () => {
    const comments = [makeComment(1, { deleted: true }), makeComment(2)]
    const client = makeMockClient((id) =>
      Promise.resolve(comments.find((c) => c.id === id) ?? null),
    )

    const result = await fetchHnCommentTree(client, [1, 2])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('hn:2')
  })

  it('skips dead comments', async () => {
    const comments = [makeComment(1, { dead: true }), makeComment(2)]
    const client = makeMockClient((id) =>
      Promise.resolve(comments.find((c) => c.id === id) ?? null),
    )

    const result = await fetchHnCommentTree(client, [1, 2])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('hn:2')
  })

  it('skips null results', async () => {
    const client = makeMockClient(() => Promise.resolve(null))
    const result = await fetchHnCommentTree(client, [1, 2, 3])
    expect(result).toEqual([])
  })

  it('skips items without a parent field (i.e. stories)', async () => {
    // fetchItem can return Story | Comment; a Story lacks 'parent'
    const story = { id: 1, title: 'Test', type: 'story', score: 10, by: 'user', time: 1700000000, descendants: 0 }
    const client = makeMockClient(() => Promise.resolve(story))
    const result = await fetchHnCommentTree(client, [1])
    expect(result).toEqual([])
  })

  it('stops recursion at maxDepth', async () => {
    // At depth > maxDepth, should return [] without calling fetchItem
    const client = makeMockClient(() => Promise.resolve(makeComment(99)))
    const result = await fetchHnCommentTree(client, [99], 11, 10)
    expect(result).toEqual([])
    expect(client.fetchItem).not.toHaveBeenCalled()
  })

  it('fetches children at exactly maxDepth', async () => {
    const comment = makeComment(1)
    const client = makeMockClient(() => Promise.resolve(comment))
    // depth === maxDepth is still valid (> maxDepth is the cutoff)
    const result = await fetchHnCommentTree(client, [1], 10, 10)
    expect(result).toHaveLength(1)
  })
})

describe('fetchHnCommentBatch', () => {
  it('returns empty array for empty id list', async () => {
    const client = makeMockClient(() => Promise.resolve(null))
    const result = await fetchHnCommentBatch(client, [])
    expect(result).toEqual([])
    expect(client.fetchItem).not.toHaveBeenCalled()
  })

  it('fetches a flat batch with empty children', async () => {
    const comments = [makeComment(1), makeComment(2), makeComment(3)]
    const client = makeMockClient((id) =>
      Promise.resolve(comments.find((c) => c.id === id) ?? null),
    )

    const result = await fetchHnCommentBatch(client, [1, 2, 3])
    expect(result).toHaveLength(3)
    expect(result[0].id).toBe('hn:1')
    expect(result[0].children).toEqual([])
    expect(result[0].pendingKidIds).toBeUndefined()
  })

  it('does NOT recurse into children — sets pendingKidIds instead', async () => {
    const parent = makeComment(1, { kids: [2, 3] })
    const child = makeComment(2)
    const grandchild = makeComment(3)
    const map = new Map([[1, parent], [2, child], [3, grandchild]])
    const client = makeMockClient((id) => Promise.resolve(map.get(id) ?? null))

    const result = await fetchHnCommentBatch(client, [1])

    expect(result).toHaveLength(1)
    expect(result[0].children).toEqual([])
    expect(result[0].pendingKidIds).toEqual([2, 3])
    // Crucially: child IDs were NOT fetched
    expect(client.fetchItem).toHaveBeenCalledTimes(1)
    expect(client.fetchItem).toHaveBeenCalledWith(1)
  })

  it('fans out only at the current level (parallel) without unbounded depth', async () => {
    // 100 top-level comments, each with 10 children. Batch should issue
    // exactly 100 requests, NOT 100 + 10*100 = 1100.
    const ids = Array.from({ length: 100 }, (_, i) => i + 1)
    const fetchItem = vi.fn((id: number) =>
      Promise.resolve(makeComment(id, { kids: [id * 1000, id * 1000 + 1] })),
    )
    const client = { fetchItem } as unknown as HnClient

    const result = await fetchHnCommentBatch(client, ids)

    expect(result).toHaveLength(100)
    expect(fetchItem).toHaveBeenCalledTimes(100)
    // Every comment has its kids preserved as pending
    for (const item of result) {
      expect(item.pendingKidIds).toHaveLength(2)
    }
  })

  it('respects depth parameter for the resulting items', async () => {
    const client = makeMockClient(() => Promise.resolve(makeComment(5)))
    const result = await fetchHnCommentBatch(client, [5], 3)
    expect(result[0].depth).toBe(3)
  })

  it('skips deleted and dead comments', async () => {
    const comments = [
      makeComment(1, { deleted: true }),
      makeComment(2, { dead: true }),
      makeComment(3),
    ]
    const client = makeMockClient((id) =>
      Promise.resolve(comments.find((c) => c.id === id) ?? null),
    )

    const result = await fetchHnCommentBatch(client, [1, 2, 3])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('hn:3')
  })

  it('skips items without a parent field', async () => {
    const story = { id: 1, title: 'Test', type: 'story', score: 10, by: 'user', time: 1700000000, descendants: 0 }
    const client = makeMockClient(() => Promise.resolve(story))
    const result = await fetchHnCommentBatch(client, [1])
    expect(result).toEqual([])
  })

  it('omits pendingKidIds when comment has no kids', async () => {
    const comment = makeComment(1) // no kids
    const client = makeMockClient(() => Promise.resolve(comment))
    const result = await fetchHnCommentBatch(client, [1])
    expect(result[0].pendingKidIds).toBeUndefined()
  })

  it('omits pendingKidIds when kids is an empty array', async () => {
    const comment = makeComment(1, { kids: [] })
    const client = makeMockClient(() => Promise.resolve(comment))
    const result = await fetchHnCommentBatch(client, [1])
    expect(result[0].pendingKidIds).toBeUndefined()
  })
})

describe('fetchHnCommentChildren', () => {
  it('fetches direct children with depth = parentDepth + 1', async () => {
    const child1 = makeComment(10)
    const child2 = makeComment(20)
    const map = new Map([[10, child1], [20, child2]])
    const client = makeMockClient((id) => Promise.resolve(map.get(id) ?? null))

    const result = await fetchHnCommentChildren(client, 2, [10, 20])

    expect(result).toHaveLength(2)
    expect(result[0].depth).toBe(3)
    expect(result[1].depth).toBe(3)
  })

  it('does not recurse — grandchildren stay pending', async () => {
    const child = makeComment(10, { kids: [100, 101] })
    const grandchild = makeComment(100)
    const map = new Map([[10, child], [100, grandchild], [101, grandchild]])
    const client = makeMockClient((id) => Promise.resolve(map.get(id) ?? null))

    const result = await fetchHnCommentChildren(client, 0, [10])

    expect(client.fetchItem).toHaveBeenCalledTimes(1)
    expect(result[0].pendingKidIds).toEqual([100, 101])
    expect(result[0].children).toEqual([])
  })

  it('returns empty array for empty kid list', async () => {
    const client = makeMockClient(() => Promise.resolve(null))
    const result = await fetchHnCommentChildren(client, 0, [])
    expect(result).toEqual([])
    expect(client.fetchItem).not.toHaveBeenCalled()
  })
})
