import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FeedManager } from '../src/feeds.js'
import { HnClient } from '../src/client.js'
import type { Story } from '../src/models.js'

function makeStory(id: number): Story {
  return {
    id,
    title: `Story ${id}`,
    score: id * 10,
    by: 'user',
    time: Date.now() / 1000,
    descendants: 0,
    type: 'story',
  }
}

describe('FeedManager', () => {
  let mockClient: { fetchFeedIds: ReturnType<typeof vi.fn>; fetchItem: ReturnType<typeof vi.fn> }
  let manager: FeedManager

  beforeEach(() => {
    vi.useFakeTimers()
    mockClient = {
      fetchFeedIds: vi.fn(),
      fetchItem: vi.fn(),
    }
    manager = new FeedManager(mockClient as unknown as HnClient)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches a page of stories', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => i + 1)
    mockClient.fetchFeedIds.mockResolvedValueOnce(ids)
    for (let i = 1; i <= 30; i++) {
      mockClient.fetchItem.mockResolvedValueOnce(makeStory(i))
    }

    const stories = await manager.fetchPage('topstories', 0)
    expect(stories).toHaveLength(30)
    expect(stories[0].id).toBe(1)
    expect(stories[29].id).toBe(30)
  })

  it('fetches second page', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => i + 1)
    mockClient.fetchFeedIds.mockResolvedValue(ids)
    for (let i = 1; i <= 30; i++) {
      mockClient.fetchItem.mockResolvedValueOnce(makeStory(i))
    }
    await manager.fetchPage('topstories', 0)

    for (let i = 31; i <= 60; i++) {
      mockClient.fetchItem.mockResolvedValueOnce(makeStory(i))
    }
    const page2 = await manager.fetchPage('topstories', 1)
    expect(page2).toHaveLength(30)
    expect(page2[0].id).toBe(31)
  })

  it('returns cached stories within TTL', async () => {
    const ids = [1, 2, 3]
    mockClient.fetchFeedIds.mockResolvedValue(ids)
    mockClient.fetchItem
      .mockResolvedValueOnce(makeStory(1))
      .mockResolvedValueOnce(makeStory(2))
      .mockResolvedValueOnce(makeStory(3))

    await manager.fetchPage('topstories', 0)
    const callCount = mockClient.fetchItem.mock.calls.length

    await manager.fetchPage('topstories', 0)
    expect(mockClient.fetchItem.mock.calls.length).toBe(callCount)
  })

  it('refetches after cache expires', async () => {
    const ids = [1]
    mockClient.fetchFeedIds.mockResolvedValue(ids)
    mockClient.fetchItem.mockResolvedValue(makeStory(1))

    await manager.fetchPage('topstories', 0)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)

    await manager.fetchPage('topstories', 0)
    expect(mockClient.fetchItem).toHaveBeenCalledTimes(2)
  })

  it('filters out null items from failed fetches', async () => {
    const ids = [1, 2, 3]
    mockClient.fetchFeedIds.mockResolvedValueOnce(ids)
    mockClient.fetchItem
      .mockResolvedValueOnce(makeStory(1))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeStory(3))

    const stories = await manager.fetchPage('topstories', 0)
    expect(stories).toHaveLength(2)
    expect(stories.map((s) => s.id)).toEqual([1, 3])
  })
})
