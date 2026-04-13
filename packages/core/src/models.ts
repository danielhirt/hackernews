export interface Story {
  id: number
  title: string
  url?: string
  text?: string
  score: number
  by: string
  time: number
  descendants: number
  kids?: number[]
  type: 'story' | 'job' | 'poll'
}

export interface Comment {
  id: number
  text: string
  by: string
  time: number
  parent: number
  kids?: number[]
  deleted?: boolean
  dead?: boolean
}

export interface User {
  id: string
  created: number
  karma: number
  about?: string
  submitted?: number[]
}

export interface LobstersUser {
  username: string
  created_at: string
  about: string
  avatar_url: string
  invited_by_user?: string
  github_username?: string
  mastodon_username?: string
  is_admin: boolean
  is_moderator: boolean
}

export interface DevtoUser {
  username: string
  name: string
  summary: string
  joined_at: string
  profile_image: string
  website_url: string | null
  twitter_username: string | null
  github_username: string | null
  location: string | null
}

export interface Collection {
  id: string
  name: string
  color: string
  itemIds: string[]
  createdAt: number
  updatedAt: number
}

export type FeedType = 'top' | 'new' | 'best' | 'ask' | 'show' | 'job'

export const FEED_ENDPOINTS: Record<FeedType, string> = {
  top: 'topstories',
  new: 'newstories',
  best: 'beststories',
  ask: 'askstories',
  show: 'showstories',
  job: 'jobstories',
}

export const COLLECTION_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
  '#78716c', // stone
] as const

export const DEFAULT_COLLECTION_ID = 'favorites'

// --- Multi-source types ---

export type ContentSource = 'hackernews' | 'lobsters' | 'devto'

export const SOURCE_ID = {
  HN: 'hackernews' as ContentSource,
  LOBSTERS: 'lobsters' as ContentSource,
  DEVTO: 'devto' as ContentSource,
}

export const SOURCE_PREFIX: Record<ContentSource, string> = {
  hackernews: 'hn:',
  lobsters: 'lo:',
  devto: 'dev:',
}

/** Parse a prefixed ID like "hn:123" into { source, id } */
export function parseItemId(prefixedId: string): { source: ContentSource; id: string } {
  if (prefixedId.startsWith('lo:')) return { source: 'lobsters', id: prefixedId.slice(3) }
  if (prefixedId.startsWith('dev:')) return { source: 'devto', id: prefixedId.slice(4) }
  if (prefixedId.startsWith('hn:')) return { source: 'hackernews', id: prefixedId.slice(3) }
  // Bare numeric ID = legacy HN
  return { source: 'hackernews', id: prefixedId }
}

/** Build a prefixed ID from source + native ID */
export function buildItemId(source: ContentSource, nativeId: string | number): string {
  return `${SOURCE_PREFIX[source]}${nativeId}`
}

export interface FeedItem {
  id: string               // Source-prefixed: "hn:123", "lo:abc", "dev:456"
  source: ContentSource
  title: string
  url?: string
  text?: string
  score: number
  author: string
  timestamp: number        // Unix seconds
  commentCount: number
  sourceUrl: string        // URL to item on source site
  tags?: string[]
  originalId?: number | string  // Source-native ID for detail pages
}

export interface SourceFeed {
  id: string
  label: string
  source: ContentSource
}

export interface SourceConfig {
  id: ContentSource
  name: string
  shortName: string
  color: string
  feeds: SourceFeed[]
}

export interface CommentItem {
  id: string
  source: ContentSource
  text: string
  author: string
  timestamp: number
  score?: number
  deleted?: boolean
  dead?: boolean
  children: CommentItem[]
  depth: number
  sourceUrl?: string
}

export const SOURCES: SourceConfig[] = [
  {
    id: 'hackernews',
    name: 'Hacker News',
    shortName: 'HN',
    color: '#ff6600',
    feeds: [
      { id: 'top', label: 'Top', source: 'hackernews' },
      { id: 'new', label: 'New', source: 'hackernews' },
      { id: 'best', label: 'Best', source: 'hackernews' },
      { id: 'ask', label: 'Ask', source: 'hackernews' },
      { id: 'show', label: 'Show', source: 'hackernews' },
      { id: 'job', label: 'Jobs', source: 'hackernews' },
    ],
  },
  {
    id: 'lobsters',
    name: 'Lobsters',
    shortName: 'Lobsters',
    color: '#ac130d',
    feeds: [
      { id: 'hottest', label: 'Hottest', source: 'lobsters' },
      { id: 'newest', label: 'Newest', source: 'lobsters' },
      { id: 'active', label: 'Active', source: 'lobsters' },
    ],
  },
  {
    id: 'devto',
    name: 'DEV Community',
    shortName: 'DEV',
    color: '#3b49df',
    feeds: [
      { id: 'top', label: 'Top', source: 'devto' },
      { id: 'latest', label: 'Latest', source: 'devto' },
      { id: 'rising', label: 'Rising', source: 'devto' },
    ],
  },
]
