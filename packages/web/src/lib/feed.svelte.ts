import {
  createSourceClient,
  LobstersClient,
  SOURCE_ID,
  type SourceClient,
  type ContentSource,
  type FeedItem,
} from '@hackernews/core'

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

let currentKey = $state('')
let currentSource = $state<ContentSource>('hackernews')
let currentFeedId = $state('top')
let currentTag = $state<string | null>(null)
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
  }
}

export async function loadFeed(source: ContentSource, feedId: string, tag?: string | null) {
  const key = tag ? `${source}:tag:${tag}` : `${source}:${feedId}`
  if (key === currentKey && items.length > 0) return

  currentKey = key
  currentSource = source
  currentFeedId = feedId
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
    items = result
    cache.set(key, { items: result, currentPage: 0, exhausted: result.length === 0 })
  } catch (err) {
    console.error(`Failed to load ${source}/${feedId}:`, err)
    items = []
  }
  loading = false
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
  cache.delete(currentKey)
  const client = getClient(currentSource)
  if ('clearCache' in client && typeof (client as any).clearCache === 'function') {
    (client as any).clearCache()
  }
  loading = true
  try {
    const result = await client.fetchFeed(currentFeedId, 0)
    items = result
    cache.set(currentKey, { items: result, currentPage: 0, exhausted: result.length === 0 })
  } catch (err) {
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

  loadingMore = true
  try {
    const nextPage = entry.currentPage + 1
    const client = getClient(currentSource)
    let result: FeedItem[]
    if (currentTag && client.fetchTag) {
      result = await client.fetchTag(currentTag, nextPage)
    } else {
      result = await client.fetchFeed(currentFeedId, nextPage)
    }
    if (result.length === 0) {
      entry.exhausted = true
    } else {
      items = [...items, ...result]
      entry.items = items
      entry.currentPage = nextPage
    }
  } catch (err) {
    console.error('Failed to load more:', err)
    // Back off to prevent retry storms on rate limits
    loadMoreCooldown = true
    setTimeout(() => { loadMoreCooldown = false }, 5000)
  }
  loadingMore = false
}
