import {
  createSourceClient,
  LobstersClient,
  SOURCE_ID,
  type SourceClient,
  type ContentSource,
  type FeedItem,
  type OmnifeedMode,
  type FeedView,
  OMNIFEED_MAP,
  mergeFeeds,
} from '@omnifeed/core'

interface FeedCache {
  items: FeedItem[]
  currentPage: number
  exhausted: boolean
}

const clients = new Map<ContentSource, SourceClient>()
const cache = new Map<string, FeedCache>()

function getClient(source: ContentSource): SourceClient {
  let client = clients.get(source)
  if (!client) {
    if (source === SOURCE_ID.LOBSTERS) {
      // Proxy through SvelteKit API route — Lobsters has no CORS headers
      client = new LobstersClient(undefined, '/api/lobsters?path=')
    } else {
      client = createSourceClient(source)
    }
    clients.set(source, client)
  }
  return client
}

let requestId = 0
let currentKey = $state('')
let currentSource = $state<ContentSource>('hackernews')
let currentFeedId = $state('top')
let currentTag = $state<string | null>(null)
let currentView = $state<FeedView>('omnifeed')
let omnifeedMode = $state<OmnifeedMode>('newest')
let items = $state<FeedItem[]>([])
let loading = $state(false)
let loadingMore = $state(false)

export function getFeedState() {
  return {
    get items() { return items },
    get loading() { return loading },
    get loadingMore() { return loadingMore },
    get source() { return currentSource },
    get feedId() { return currentFeedId },
    get tag() { return currentTag },
    get view() { return currentView },
    get omnifeedMode() { return omnifeedMode },
  }
}

export async function loadFeed(source: ContentSource, feedId: string, tag?: string | null) {
  currentView = source
  const key = tag ? `${source}:tag:${tag}` : `${source}:${feedId}`
  if (key === currentKey && items.length > 0) return

  const thisRequest = ++requestId
  currentKey = key
  currentSource = source
  if (!tag) currentFeedId = feedId
  currentTag = tag ?? null
  loadMoreCooldown = false

  const cached = cache.get(key)
  if (cached) {
    items = cached.items
    loading = false
    return
  }

  loading = true
  try {
    const client = getClient(source)
    let result: FeedItem[]
    if (tag && client.fetchTag) {
      result = await client.fetchTag(tag, 0)
    } else {
      result = await client.fetchFeed(feedId, 0)
    }
    if (thisRequest !== requestId) return
    items = result
    cache.set(key, { items: result, currentPage: 0, exhausted: result.length === 0 })
  } catch (err) {
    if (thisRequest !== requestId) return
    console.error(`Failed to load ${source}/${feedId}:`, err)
    items = []
  }
  loading = false
}

export async function loadOmnifeed(mode: OmnifeedMode) {
  const key = `omnifeed:${mode}`
  omnifeedMode = mode
  currentView = 'omnifeed'

  // Check cache
  const cached = cache.get(key)
  if (cached && currentKey === key) {
    items = cached.items
    return
  }

  currentKey = key
  loading = true
  items = []
  const myRequestId = ++requestId

  try {
    const sourceIds: ContentSource[] = ['hackernews', 'lobsters', 'devto']
    const feedMap = OMNIFEED_MAP[mode]

    const results = await Promise.all(
      sourceIds.map(async (sourceId) => {
        try {
          const client = getClient(sourceId)
          return await client.fetchFeed(feedMap[sourceId], 0)
        } catch (err) {
          console.error(`Failed to fetch ${sourceId}:`, err)
          return [] as FeedItem[]
        }
      })
    )

    if (myRequestId !== requestId) return

    const feedsBySource: Partial<Record<ContentSource, FeedItem[]>> = {}
    sourceIds.forEach((id, i) => { feedsBySource[id] = results[i] })
    const sortBy = mode === 'hottest' ? 'score' as const : 'newest' as const
    const merged = mergeFeeds(feedsBySource, sortBy)

    items = merged
    cache.set(key, { items: merged, currentPage: 0, exhausted: false })
  } finally {
    if (myRequestId === requestId) loading = false
  }
}

let customRefresh: (() => void) | null = null

export function setRefreshHandler(handler: (() => void) | null) {
  customRefresh = handler
}

export async function refreshFeed() {
  if (customRefresh) {
    customRefresh()
    return
  }
  if (currentView === 'omnifeed') {
    cache.delete(currentKey)
    await loadOmnifeed(omnifeedMode)
    return
  }
  const thisRequest = ++requestId
  cache.delete(currentKey)
  const client = getClient(currentSource)
  if ('clearCache' in client && typeof (client as any).clearCache === 'function') {
    (client as any).clearCache()
  }
  loading = true
  try {
    let result: FeedItem[]
    if (currentTag && client.fetchTag) {
      result = await client.fetchTag(currentTag, 0)
    } else {
      result = await client.fetchFeed(currentFeedId, 0)
    }
    if (thisRequest !== requestId) return
    items = result
    cache.set(currentKey, { items: result, currentPage: 0, exhausted: result.length === 0 })
  } catch (err) {
    if (thisRequest !== requestId) return
    console.error('Failed to refresh feed:', err)
    items = []
  }
  loading = false
}

let loadMoreCooldown = false

export async function loadMore() {
  if (loadingMore || loading || loadMoreCooldown) return
  const entry = cache.get(currentKey)
  if (!entry || entry.exhausted) return

  const thisRequest = ++requestId
  loadingMore = true

  if (currentView === 'omnifeed') {
    const sourceIds: ContentSource[] = ['hackernews', 'lobsters', 'devto']
    const feedMap = OMNIFEED_MAP[omnifeedMode]

    const results = await Promise.all(
      sourceIds.map(async (sourceId) => {
        try {
          const client = getClient(sourceId)
          return await client.fetchFeed(feedMap[sourceId], entry.currentPage + 1)
        } catch {
          return [] as FeedItem[]
        }
      })
    )

    const newItems = results.flat()

    if (newItems.length === 0) {
      entry.exhausted = true
    } else {
      entry.currentPage++
      if (omnifeedMode === 'hottest') {
        // Score-sorted: new page items may outscore existing ones, merge-insert
        const merged = [...entry.items, ...newItems]
        merged.sort((a, b) => b.score - a.score)
        entry.items = merged
      } else {
        // Chronological: new pages are older, append directly
        entry.items = [...entry.items, ...newItems]
      }
      items = entry.items
    }

    loadingMore = false
    loadMoreCooldown = true
    setTimeout(() => { loadMoreCooldown = false }, 5000)
    return
  }

  try {
    const nextPage = entry.currentPage + 1
    const client = getClient(currentSource)
    let result: FeedItem[]
    if (currentTag && client.fetchTag) {
      result = await client.fetchTag(currentTag, nextPage)
    } else {
      result = await client.fetchFeed(currentFeedId, nextPage)
    }
    if (thisRequest !== requestId) return
    if (result.length === 0) {
      entry.exhausted = true
    } else {
      items = [...items, ...result]
      entry.items = items
      entry.currentPage = nextPage
    }
  } catch (err) {
    if (thisRequest !== requestId) return
    console.error('Failed to load more:', err)
    // Back off to prevent retry storms on rate limits
    loadMoreCooldown = true
    setTimeout(() => { loadMoreCooldown = false }, 5000)
  } finally {
    loadingMore = false
  }
}
