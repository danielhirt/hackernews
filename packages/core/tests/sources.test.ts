import { describe, it, expect, vi } from 'vitest'
import { storyToFeedItem, HnSourceAdapter, createSourceClient } from '../src/sources.js'
import type { Story } from '../src/models.js'

function makeStory(id: number): Story {
  return {
    id,
    title: `Story ${id}`,
    url: `https://example.com/${id}`,
    score: id * 10,
    by: 'testuser',
    time: 1700000000,
    descendants: id,
    type: 'story',
  }
}

describe('storyToFeedItem', () => {
  it('maps id as "hn:<id>"', () => {
    const item = storyToFeedItem(makeStory(42))
    expect(item.id).toBe('hn:42')
  })

  it('sets source to "hackernews"', () => {
    const item = storyToFeedItem(makeStory(42))
    expect(item.source).toBe('hackernews')
  })

  it('maps author from story.by', () => {
    const story = { ...makeStory(1), by: 'alice' }
    const item = storyToFeedItem(story)
    expect(item.author).toBe('alice')
  })

  it('maps timestamp from story.time', () => {
    const story = { ...makeStory(1), time: 1700000000 }
    const item = storyToFeedItem(story)
    expect(item.timestamp).toBe(1700000000)
  })

  it('maps commentCount from story.descendants', () => {
    const story = { ...makeStory(5), descendants: 17 }
    const item = storyToFeedItem(story)
    expect(item.commentCount).toBe(17)
  })

  it('defaults commentCount to 0 when descendants is undefined', () => {
    const story = { ...makeStory(1), descendants: undefined as unknown as number }
    const item = storyToFeedItem(story)
    expect(item.commentCount).toBe(0)
  })

  it('includes story id in sourceUrl', () => {
    const item = storyToFeedItem(makeStory(42))
    expect(item.sourceUrl).toContain('42')
    expect(item.sourceUrl).toContain('news.ycombinator.com')
  })

  it('sets originalId to the numeric story id', () => {
    const item = storyToFeedItem(makeStory(42))
    expect(item.originalId).toBe(42)
  })

  it('passes through url when present', () => {
    const story = { ...makeStory(1), url: 'https://example.com/article' }
    const item = storyToFeedItem(story)
    expect(item.url).toBe('https://example.com/article')
  })

  it('passes through text when present', () => {
    const story = { ...makeStory(1), text: 'some body text' }
    const item = storyToFeedItem(story)
    expect(item.text).toBe('some body text')
  })

  it('leaves url undefined when story has no url', () => {
    const story: Story = { id: 1, title: 'T', score: 10, by: 'u', time: 1, descendants: 0, type: 'story' }
    const item = storyToFeedItem(story)
    expect(item.url).toBeUndefined()
  })
})

describe('HnSourceAdapter', () => {
  function makeMockFetch(feedIds: number[], story: Story) {
    return vi.fn().mockImplementation((url: string) => {
      if (url.includes('stories.json')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(feedIds) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(story) })
    })
  }

  it('returns FeedItems from fetchFeed for a valid feed id', async () => {
    const story = makeStory(42)
    const fetch = makeMockFetch([42], story)
    const adapter = new HnSourceAdapter(fetch as any)

    const items = await adapter.fetchFeed('top', 0)

    expect(items.length).toBeGreaterThan(0)
    expect(items[0].id).toBe('hn:42')
    expect(items[0].source).toBe('hackernews')
  })

  it('throws on unknown feed id', async () => {
    const adapter = new HnSourceAdapter()
    await expect(adapter.fetchFeed('unknown', 0)).rejects.toThrow('Unknown HN feed: unknown')
  })

  it('supports all valid HN feed types', async () => {
    const feedTypes = ['top', 'new', 'best', 'ask', 'show', 'job']
    for (const feedType of feedTypes) {
      const story = makeStory(1)
      const fetch = makeMockFetch([1], story)
      const adapter = new HnSourceAdapter(fetch as any)
      // Should not throw
      await expect(adapter.fetchFeed(feedType, 0)).resolves.toBeDefined()
    }
  })
})

describe('createSourceClient', () => {
  it('returns an HnSourceAdapter for hackernews', () => {
    const client = createSourceClient('hackernews')
    expect(client).toBeInstanceOf(HnSourceAdapter)
  })

  it('returns a client with fetchFeed for lobsters', () => {
    const client = createSourceClient('lobsters')
    expect(typeof client.fetchFeed).toBe('function')
  })

  it('returns a client with fetchFeed for devto', () => {
    const client = createSourceClient('devto')
    expect(typeof client.fetchFeed).toBe('function')
  })
})
