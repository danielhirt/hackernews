import type { Story, Comment, CommentItem, FeedItem } from '@omnifeed/core'

export type SortBy = 'newest' | 'oldest' | 'points' | 'discussed'
export type FilterPeriod = 'all' | 'week' | 'month' | 'year'

const WEEK = 7 * 24 * 60 * 60
const MONTH = 30 * 24 * 60 * 60
const YEAR = 365 * 24 * 60 * 60

export function periodCutoff(period: FilterPeriod, nowSeconds?: number): number {
  if (period === 'all') return 0
  const now = nowSeconds ?? Math.floor(Date.now() / 1000)
  if (period === 'week') return now - WEEK
  if (period === 'month') return now - MONTH
  return now - YEAR
}

export function filterByPeriod<T extends { time: number }>(items: T[], period: FilterPeriod, nowSeconds?: number): T[] {
  const cutoff = periodCutoff(period, nowSeconds)
  return cutoff === 0 ? items : items.filter((i) => i.time >= cutoff)
}

export function sortStories(items: Story[], sortBy: SortBy): Story[] {
  const sorted = [...items]
  if (sortBy === 'oldest') return sorted.sort((a, b) => a.time - b.time)
  if (sortBy === 'points') return sorted.sort((a, b) => b.score - a.score)
  if (sortBy === 'discussed') return sorted.sort((a, b) => (b.descendants ?? 0) - (a.descendants ?? 0))
  return sorted.sort((a, b) => b.time - a.time)
}

export function sortComments(items: Comment[], sortBy: SortBy): Comment[] {
  const sorted = [...items]
  if (sortBy === 'oldest') return sorted.sort((a, b) => a.time - b.time)
  return sorted.sort((a, b) => b.time - a.time)
}

export function sortFeedItems(items: FeedItem[], sortBy: SortBy): FeedItem[] {
  const sorted = [...items]
  if (sortBy === 'oldest') return sorted.sort((a, b) => a.timestamp - b.timestamp)
  if (sortBy === 'points') return sorted.sort((a, b) => b.score - a.score)
  if (sortBy === 'discussed') return sorted.sort((a, b) => b.commentCount - a.commentCount)
  return sorted.sort((a, b) => b.timestamp - a.timestamp)
}

export function filterFeedItemsByPeriod(items: FeedItem[], period: FilterPeriod): FeedItem[] {
  if (period === 'all') return items
  const cutoff = periodCutoff(period)
  return items.filter((i) => i.timestamp >= cutoff)
}

export type CommentSortMode = 'default' | 'newest' | 'oldest'

export function sortCommentTree(items: CommentItem[], mode: CommentSortMode): CommentItem[] {
  if (mode === 'default') return items
  const sorted = [...items].sort((a, b) =>
    mode === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
  )
  return sorted.map((c) => ({
    ...c,
    children: sortCommentTree(c.children, mode),
  }))
}
