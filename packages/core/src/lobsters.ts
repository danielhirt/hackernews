import type { FeedItem, CommentItem, LobstersUser } from './models.js'

type FetchFn = typeof globalThis.fetch

interface LobstersRawComment {
  short_id: string
  comment: string
  comment_plain: string
  commenting_user: string
  created_at: string
  score: number
  depth: number
  parent_comment: string | null
  is_deleted: boolean
  is_moderated: boolean
  short_id_url: string
  url: string
}

interface LobstersStoryResponse extends LobstersStory {
  comments: LobstersRawComment[]
}

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

  async fetchStory(shortId: string): Promise<{ story: FeedItem; comments: CommentItem[] }> {
    const res = await this.fetch(`${this.baseUrl}/s/${shortId}.json`)
    if (!res.ok) throw new Error(`Lobsters API error: ${res.status}`)

    const data: LobstersStoryResponse = await res.json()
    return {
      story: lobstersToFeedItem(data),
      comments: buildLobstersCommentTree(data.comments),
    }
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

  async fetchUser(username: string): Promise<LobstersUser> {
    const res = await this.fetch(`${this.baseUrl}/~${username}.json`)
    if (!res.ok) throw new Error(`Lobsters API error: ${res.status}`)
    return res.json()
  }

  async fetchTag(tag: string, page: number): Promise<FeedItem[]> {
    const path = page === 0
      ? `/t/${tag}.json`
      : `/t/${tag}/page/${page + 1}.json`

    const res = await this.fetch(`${this.baseUrl}${path}`)
    if (!res.ok) throw new Error(`Lobsters API error: ${res.status}`)

    const stories: LobstersStory[] = await res.json()
    return stories.map(lobstersToFeedItem)
  }
}

function buildLobstersCommentTree(flatComments: LobstersRawComment[]): CommentItem[] {
  const roots: CommentItem[] = []
  const map = new Map<string, CommentItem>()

  for (const raw of flatComments) {
    if (raw.is_deleted || raw.is_moderated) continue

    const item: CommentItem = {
      id: `lo:${raw.short_id}`,
      source: 'lobsters',
      text: raw.comment,
      author: raw.commenting_user,
      timestamp: Math.floor(new Date(raw.created_at).getTime() / 1000),
      score: raw.score,
      children: [],
      depth: raw.depth,
      sourceUrl: raw.short_id_url,
    }

    map.set(raw.short_id, item)

    if (raw.parent_comment && map.has(raw.parent_comment)) {
      map.get(raw.parent_comment)!.children.push(item)
    } else {
      roots.push(item)
    }
  }

  return roots
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
