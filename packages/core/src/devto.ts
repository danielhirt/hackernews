import type { FeedItem, CommentItem } from './models.js'

type FetchFn = typeof globalThis.fetch

interface DevtoArticle {
  id: number
  title: string
  url: string
  description: string
  positive_reactions_count: number
  comments_count: number
  published_timestamp: string   // ISO string
  tag_list: string[] | string
  cover_image: string | null
  user: { username: string; name: string }
  reading_time_minutes: number
  canonical_url?: string
}

interface DevtoRawComment {
  id_code: string
  body_html: string
  created_at: string
  user: { username: string; name: string }
  children: DevtoRawComment[]
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

  async fetchArticle(id: number): Promise<FeedItem> {
    const res = await this.fetch(`${BASE_URL}/articles/${id}`)
    if (!res.ok) throw new Error(`DEV API error: ${res.status}`)

    const article: DevtoArticle = await res.json()
    return devtoToFeedItem(article)
  }

  async fetchComments(articleId: number): Promise<CommentItem[]> {
    const res = await this.fetch(`${BASE_URL}/comments?a_id=${articleId}`)
    if (!res.ok) throw new Error(`DEV API error: ${res.status}`)

    const raw: DevtoRawComment[] = await res.json()
    return raw.map((c) => buildDevtoCommentTree(c, 0))
  }

  async fetchTag(tag: string, page: number): Promise<FeedItem[]> {
    const pageNum = page + 1
    const url = `${BASE_URL}/articles?tag=${encodeURIComponent(tag)}&page=${pageNum}&per_page=${PER_PAGE}`
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

function buildDevtoCommentTree(raw: DevtoRawComment, depth: number): CommentItem {
  return {
    id: `dev:${raw.id_code}`,
    source: 'devto',
    text: raw.body_html,
    author: raw.user.username,
    timestamp: Math.floor(new Date(raw.created_at).getTime() / 1000),
    children: raw.children.map((c) => buildDevtoCommentTree(c, depth + 1)),
    depth,
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
    tags: Array.isArray(article.tag_list)
      ? article.tag_list
      : article.tag_list.split(',').map((t: string) => t.trim()).filter(Boolean),
    originalId: article.id,
  }
}
