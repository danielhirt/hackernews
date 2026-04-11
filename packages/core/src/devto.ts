import type { FeedItem } from './models.js'

type FetchFn = typeof globalThis.fetch

interface DevtoArticle {
  id: number
  title: string
  url: string
  description: string
  positive_reactions_count: number
  comments_count: number
  published_timestamp: string   // ISO string
  tag_list: string[]
  cover_image: string | null
  user: { username: string; name: string }
  reading_time_minutes: number
  canonical_url?: string
}

const BASE_URL = 'https://dev.to/api'
const PER_PAGE = 30

export class DevtoClient {
  private fetch: FetchFn

  constructor(fetchFn?: FetchFn) {
    this.fetch = fetchFn ?? globalThis.fetch.bind(globalThis)
  }

  async fetchFeed(feedId: string, page: number): Promise<FeedItem[]> {
    const url = this.buildUrl(feedId, page)
    const res = await this.fetch(url)
    if (!res.ok) throw new Error(`DEV API error: ${res.status}`)

    const articles: DevtoArticle[] = await res.json()
    return articles.map(devtoToFeedItem)
  }

  private buildUrl(feedId: string, page: number): string {
    const pageNum = page + 1
    switch (feedId) {
      case 'top':
        return `${BASE_URL}/articles?top=7&page=${pageNum}&per_page=${PER_PAGE}`
      case 'latest':
        return `${BASE_URL}/articles/latest?page=${pageNum}&per_page=${PER_PAGE}`
      case 'rising':
      default:
        return `${BASE_URL}/articles?page=${pageNum}&per_page=${PER_PAGE}`
    }
  }
}

function devtoToFeedItem(article: DevtoArticle): FeedItem {
  return {
    id: `dev:${article.id}`,
    source: 'devto',
    title: article.title,
    url: article.canonical_url ?? article.url,
    text: article.description || undefined,
    score: article.positive_reactions_count,
    author: article.user.username,
    timestamp: Math.floor(new Date(article.published_timestamp).getTime() / 1000),
    commentCount: article.comments_count,
    sourceUrl: article.url,
    tags: article.tag_list,
    originalId: article.id,
  }
}
