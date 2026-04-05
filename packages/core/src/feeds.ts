import type { Story } from './models.js'
import { TtlCache } from './cache.js'
import { HnClient } from './client.js'

const PAGE_SIZE = 30
const CHUNK_SIZE = 10
const FEED_IDS_TTL = 5 * 60 * 1000
const ITEM_TTL = 5 * 60 * 1000

export class FeedManager {
  private feedIdsCache = new TtlCache<number[]>(FEED_IDS_TTL)
  private itemCache = new TtlCache<Story>(ITEM_TTL)

  constructor(private client: HnClient) {}

  async fetchPage(endpoint: string, page: number): Promise<Story[]> {
    const ids = await this.getFeedIds(endpoint)
    const start = page * PAGE_SIZE
    const pageIds = ids.slice(start, start + PAGE_SIZE)
    return this.fetchItems(pageIds)
  }

  private async getFeedIds(endpoint: string): Promise<number[]> {
    const cached = this.feedIdsCache.get(endpoint)
    if (cached) return cached

    const ids = await this.client.fetchFeedIds(endpoint)
    this.feedIdsCache.set(endpoint, ids)
    return ids
  }

  private async fetchItems(ids: number[]): Promise<Story[]> {
    const results: (Story | null)[] = []

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE)
      const chunkResults = await Promise.all(
        chunk.map(async (id) => {
          const cached = this.itemCache.get(String(id))
          if (cached) return cached

          const item = await this.client.fetchItem(id)
          if (item && 'title' in item) {
            this.itemCache.set(String(id), item as Story)
            return item as Story
          }
          return null
        }),
      )
      results.push(...chunkResults)
    }

    return results.filter((item): item is Story => item !== null)
  }
}
