import type { Story, FeedItem, ContentSource, FeedType } from './models.js'
import { FEED_ENDPOINTS } from './models.js'
import { FeedManager } from './feeds.js'
import { HnClient } from './client.js'
import { LobstersClient } from './lobsters.js'
import { DevtoClient } from './devto.js'

type FetchFn = typeof globalThis.fetch

export interface SourceClient {
  fetchFeed(feedId: string, page: number): Promise<FeedItem[]>
  fetchTag?(tag: string, page: number): Promise<FeedItem[]>
}

export class HnSourceAdapter implements SourceClient {
  private feedManager: FeedManager

  constructor(fetchFn?: FetchFn) {
    this.feedManager = new FeedManager(new HnClient(fetchFn))
  }

  async fetchFeed(feedId: string, page: number): Promise<FeedItem[]> {
    const endpoint = FEED_ENDPOINTS[feedId as FeedType]
    if (!endpoint) throw new Error(`Unknown HN feed: ${feedId}`)
    const stories = await this.feedManager.fetchPage(endpoint, page)
    return stories.map(storyToFeedItem)
  }

  clearCache(): void {
    this.feedManager.clearCache()
  }
}

export function storyToFeedItem(story: Story): FeedItem {
  return {
    id: `hn:${story.id}`,
    source: 'hackernews',
    title: story.title,
    url: story.url,
    text: story.text,
    score: story.score,
    author: story.by,
    timestamp: story.time,
    commentCount: story.descendants ?? 0,
    sourceUrl: `https://news.ycombinator.com/item?id=${story.id}`,
    originalId: story.id,
  }
}

export function createSourceClient(source: ContentSource, fetchFn?: FetchFn): SourceClient {
  switch (source) {
    case 'hackernews':
      return new HnSourceAdapter(fetchFn)
    case 'lobsters':
      return new LobstersClient(fetchFn)
    case 'devto':
      return new DevtoClient(fetchFn)
  }
}
