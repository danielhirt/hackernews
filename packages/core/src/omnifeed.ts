import type { ContentSource, FeedItem } from './models.js'

export type OmnifeedMode = 'newest' | 'hottest'

export type FeedView = ContentSource | 'omnifeed'

export const OMNIFEED_MAP: Record<OmnifeedMode, Record<ContentSource, string>> = {
  newest: { hackernews: 'new', lobsters: 'newest', devto: 'latest' },
  hottest: { hackernews: 'top', lobsters: 'hottest', devto: 'top' },
}

export type OmnifeedSort = 'newest' | 'score'

export function mergeFeeds(
  feedsBySource: Partial<Record<ContentSource, FeedItem[]>>,
  sort: OmnifeedSort = 'newest'
): FeedItem[] {
  const seen = new Set<string>()
  const items = (Object.values(feedsBySource) as FeedItem[][])
    .flat()
    .filter(item => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  if (sort === 'score') {
    return items.sort((a, b) => b.score - a.score)
  }
  return items.sort((a, b) => b.timestamp - a.timestamp)
}
