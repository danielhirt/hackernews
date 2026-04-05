export interface Story {
  id: number
  title: string
  url?: string
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
}

export interface Collection {
  id: string
  name: string
  color: string
  itemIds: number[]
  createdAt: number
  updatedAt: number
}

export interface SavedItem {
  itemId: number
  collectionId: string
  savedAt: number
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

export const DEFAULT_COLLECTION_ID = 'saved'
