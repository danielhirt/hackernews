import {
  createSourceClient,
  LobstersClient,
  SOURCE_ID,
  SOURCES,
  type SourceClient,
  type ContentSource,
  type FeedItem,
  type OmnifeedMode,
  type OmnifeedSort,
  type FeedView,
  OMNIFEED_MAP,
  mergeFeeds,
} from '@omnifeed/core'

interface FeedCache {
  items: FeedItem[]
  currentPage: number
  exhausted: boolean
  fetchedAt: number
}

const FEED_CACHE_TTL = 5 * 60 * 1000

function isCacheStale(entry: FeedCache): boolean {
  return Date.now() - entry.fetchedAt >= FEED_CACHE_TTL
}

const clients = new Map<ContentSource, SourceClient>()
const cache = new Map<string, FeedCache>()
const allSourceIds = SOURCES.map(s => s.id)

function getClient(source: ContentSource): SourceClient {
  let client = clients.get(source)
  if (!client) {
    if (source === SOURCE_ID.LOBSTERS) {
      // Lobsters has no CORS headers
      client = new LobstersClient(undefined, '/api/lobsters?path=')
    } else {
      client = createSourceClient(source)
    }
    clients.set(source, client)
  }
  return client
}

async function fetchAllSources(mode: OmnifeedMode, page: number): Promise<FeedItem[][]> {
  const feedMap = OMNIFEED_MAP[mode]
  return Promise.all(
    allSourceIds.map(async (sourceId) => {
      try {
        const client = getClient(sourceId)
        return await client.fetchFeed(feedMap[sourceId], page)
      } catch (err) {
        if (page === 0) console.error(`Failed to fetch ${sourceId}:`, err)
        return [] as FeedItem[]
      }
    })
  )
}

let requestId = 0
let currentKey = $state('')
let currentSource = $state<ContentSource>('hackernews')
let currentFeedId = $state('top')
let currentTag = $state<string | null>(null)
let currentView = $state<FeedView>('omnifeed')
let omnifeedMode = $state<OmnifeedMode>('newest')
let sourceFilter = $state<string>('all')
let feedFilter = $state<string>('all')
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
    get sourceFilter() { return sourceFilter },
    set sourceFilter(v: string) { sourceFilter = v },
    get feedFilter() { return feedFilter },
    set feedFilter(v: string) { feedFilter = v },
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
    if (isCacheStale(cached)) {
      revalidateFeed(key, source, feedId, tag ?? null)
    }
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
    cache.set(key, { items: result, currentPage: 0, exhausted: result.length === 0, fetchedAt: Date.now() })
  } catch (err) {
    if (thisRequest !== requestId) return
    console.error(`Failed to load ${source}/${feedId}:`, err)
    items = []
  }
  loading = false
}

function sortForMode(mode: OmnifeedMode): OmnifeedSort {
  return mode === 'hottest' ? 'score' : 'newest'
}

function revalidateFeed(
  key: string,
  source: ContentSource,
  feedId: string,
  tag: string | null,
): void {
  const myRequest = ++requestId
  const client = getClient(source)

  const fetchPromise = tag && client.fetchTag
    ? client.fetchTag(tag, 0)
    : client.fetchFeed(feedId, 0)

  fetchPromise.then((result) => {
    if (myRequest !== requestId) return
    items = result
    cache.set(key, { items: result, currentPage: 0, exhausted: result.length === 0, fetchedAt: Date.now() })
  }).catch(() => {
    // On failure, keep stale data
  })
}

function revalidateOmnifeed(key: string, mode: OmnifeedMode): void {
  const myRequest = ++requestId

  fetchAllSources(mode, 0).then((results) => {
    if (myRequest !== requestId) return
    const feedsBySource: Partial<Record<ContentSource, FeedItem[]>> = {}
    allSourceIds.forEach((id, i) => { feedsBySource[id] = results[i] })
    const merged = mergeFeeds(feedsBySource, sortForMode(mode))
    items = merged
    cache.set(key, { items: merged, currentPage: 0, exhausted: false, fetchedAt: Date.now() })
  }).catch(() => {
    // On failure, keep stale data
  })
}

export async function loadOmnifeed(mode: OmnifeedMode) {
  const key = `omnifeed:${mode}`
  omnifeedMode = mode
  currentView = 'omnifeed'

  const cached = cache.get(key)
  if (cached) {
    currentKey = key
    items = cached.items
    if (isCacheStale(cached)) {
      revalidateOmnifeed(key, mode)
    }
    return
  }

  currentKey = key
  loading = true
  items = []
  const myRequestId = ++requestId

  try {
    const results = await fetchAllSources(mode, 0)
    if (myRequestId !== requestId) return

    const feedsBySource: Partial<Record<ContentSource, FeedItem[]>> = {}
    allSourceIds.forEach((id, i) => { feedsBySource[id] = results[i] })
    const merged = mergeFeeds(feedsBySource, sortForMode(mode))

    items = merged
    cache.set(key, { items: merged, currentPage: 0, exhausted: false, fetchedAt: Date.now() })
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
    cache.set(currentKey, { items: result, currentPage: 0, exhausted: result.length === 0, fetchedAt: Date.now() })
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
    const results = await fetchAllSources(omnifeedMode, entry.currentPage + 1)
    const existingIds = new Set(entry.items.map(i => i.id))
    const newItems = results.flat().filter(i => !existingIds.has(i.id))

    if (newItems.length === 0) {
      entry.exhausted = true
    } else {
      entry.currentPage++
      if (omnifeedMode === 'hottest') {
        // New page items may outscore existing ones across sources
        entry.items.push(...newItems)
        entry.items.sort((a, b) => b.score - a.score)
      } else {
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
    loadMoreCooldown = true
    setTimeout(() => { loadMoreCooldown = false }, 5000)
  } finally {
    loadingMore = false
  }
}
