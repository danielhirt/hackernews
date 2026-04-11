import type { FeedItem } from './models.js'

type FetchFn = typeof globalThis.fetch

interface LobstersStory {
  short_id: string
  title: string
  url: string
  score: number
  created_at: string       // ISO date string like "2026-04-11T04:58:56.000-05:00"
  submitter_user: string   // NOTE: this is a plain string, NOT an object
  comment_count: number
  comments_url: string
  short_id_url: string
  description: string
  tags: string[]
}

export class LobstersClient {
  private fetch: FetchFn
  private baseUrl: string

  constructor(fetchFn?: FetchFn, baseUrl = 'https://lobste.rs') {
    this.fetch = fetchFn ?? globalThis.fetch.bind(globalThis)
    this.baseUrl = baseUrl
  }

  async fetchFeed(feedId: string, page: number): Promise<FeedItem[]> {
    const path = page === 0
      ? `/${feedId}.json`
      : `/${feedId}/page/${page + 1}.json`

    const res = await this.fetch(`${this.baseUrl}${path}`)
    if (!res.ok) throw new Error(`Lobsters API error: ${res.status}`)

    const stories: LobstersStory[] = await res.json()
    return stories.map(lobstersToFeedItem)
  }
}

function lobstersToFeedItem(story: LobstersStory): FeedItem {
  return {
    id: `lo:${story.short_id}`,
    source: 'lobsters',
    title: story.title,
    url: story.url || undefined,
    text: story.description || undefined,
    score: story.score,
    author: story.submitter_user,
    timestamp: Math.floor(new Date(story.created_at).getTime() / 1000),
    commentCount: story.comment_count,
    sourceUrl: story.comments_url,
    tags: story.tags,
    originalId: story.short_id,
  }
}
