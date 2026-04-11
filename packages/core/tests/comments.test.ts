import { describe, it, expect, vi } from 'vitest'
import type { Comment } from '../src/models.js'
import type { HnClient } from '../src/client.js'
import { hnCommentToItem, fetchHnCommentTree } from '../src/comments.js'

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
