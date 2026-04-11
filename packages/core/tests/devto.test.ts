import { describe, it, expect, vi } from 'vitest'
import { DevtoClient } from '../src/devto.js'

function makeDevtoArticle(overrides = {}) {
  return {
    id: 67890,
    title: 'Test DEV Article',
    url: 'https://dev.to/user/test-article',
    description: 'A test article',
    positive_reactions_count: 100,
    comments_count: 20,
    published_timestamp: '2024-01-15T10:30:00Z',
    tag_list: ['javascript', 'webdev'],
    cover_image: 'https://example.com/cover.jpg',
    user: { username: 'testuser', name: 'Test User' },
    reading_time_minutes: 5,
    ...overrides,
  }
}

function mockFetch(articles: object[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(articles),
  })
}

describe('DevtoClient', () => {
  describe('field mapping', () => {
    it('maps a DEV.to article to FeedItem correctly', async () => {
      const article = makeDevtoArticle()
      const fetch = mockFetch([article])
      const client = new DevtoClient(fetch as any)

      const items = await client.fetchFeed('top', 0)

      expect(items).toHaveLength(1)
      const item = items[0]
      expect(item.id).toBe('dev:67890')
      expect(item.source).toBe('devto')
      expect(item.title).toBe('Test DEV Article')
      expect(item.url).toBe('https://dev.to/user/test-article')
      expect(item.score).toBe(100)
      expect(item.author).toBe('testuser')
      expect(item.commentCount).toBe(20)
      expect(item.sourceUrl).toBe('https://dev.to/user/test-article')
      expect(item.tags).toEqual(['javascript', 'webdev'])
      expect(item.originalId).toBe(67890)
    })

    it('converts published_timestamp ISO string to unix timestamp', async () => {
      const article = makeDevtoArticle({ published_timestamp: '2024-01-15T10:30:00Z' })
      const fetch = mockFetch([article])
      const client = new DevtoClient(fetch as any)

      const items = await client.fetchFeed('top', 0)

      expect(items[0].timestamp).toBe(Math.floor(new Date('2024-01-15T10:30:00Z').getTime() / 1000))
    })

    it('sets text from description when present', async () => {
      const article = makeDevtoArticle({ description: 'A test article' })
      const fetch = mockFetch([article])
      const client = new DevtoClient(fetch as any)

      const items = await client.fetchFeed('top', 0)

      expect(items[0].text).toBe('A test article')
    })

    it('sets text to undefined when description is empty', async () => {
      const article = makeDevtoArticle({ description: '' })
      const fetch = mockFetch([article])
      const client = new DevtoClient(fetch as any)

      const items = await client.fetchFeed('top', 0)

      expect(items[0].text).toBeUndefined()
    })

    it('uses canonical_url as url when present', async () => {
      const article = makeDevtoArticle({
        url: 'https://dev.to/user/test-article',
        canonical_url: 'https://myblog.com/test-article',
      })
      const fetch = mockFetch([article])
      const client = new DevtoClient(fetch as any)

      const items = await client.fetchFeed('top', 0)

      expect(items[0].url).toBe('https://myblog.com/test-article')
      expect(items[0].sourceUrl).toBe('https://dev.to/user/test-article')
    })
  })

  describe('URL construction', () => {
    it('top feed uses /articles? with top=7 and page=1 for page 0', async () => {
      const fetch = mockFetch([makeDevtoArticle()])
      const client = new DevtoClient(fetch as any)

      await client.fetchFeed('top', 0)

      const url = (fetch as any).mock.calls[0][0] as string
      expect(url).toContain('/articles?')
      expect(url).toContain('top=7')
      expect(url).toContain('page=1')
    })

    it('latest feed uses /articles/latest? and page=2 for page 1', async () => {
      const fetch = mockFetch([makeDevtoArticle()])
      const client = new DevtoClient(fetch as any)

      await client.fetchFeed('latest', 1)

      const url = (fetch as any).mock.calls[0][0] as string
      expect(url).toContain('/articles/latest?')
      expect(url).toContain('page=2')
    })

    it('rising feed uses /articles? but NOT top=', async () => {
      const fetch = mockFetch([makeDevtoArticle()])
      const client = new DevtoClient(fetch as any)

      await client.fetchFeed('rising', 0)

      const url = (fetch as any).mock.calls[0][0] as string
      expect(url).toContain('/articles?')
      expect(url).not.toContain('top=')
    })

    it('unknown feedId defaults to rising (no top= param)', async () => {
      const fetch = mockFetch([makeDevtoArticle()])
      const client = new DevtoClient(fetch as any)

      await client.fetchFeed('unknown', 0)

      const url = (fetch as any).mock.calls[0][0] as string
      expect(url).toContain('/articles?')
      expect(url).not.toContain('top=')
    })
  })

  describe('error handling', () => {
    it('throws on non-ok response', async () => {
      const fetch = vi.fn().mockResolvedValue({ ok: false, status: 422 })
      const client = new DevtoClient(fetch as any)

      await expect(client.fetchFeed('top', 0)).rejects.toThrow('DEV API error: 422')
    })
  })

  describe('fetchTag', () => {
    it('fetches /articles?tag={tag} for page 0', async () => {
      const fetch = mockFetch([makeDevtoArticle()])
      const client = new DevtoClient(fetch as any)

      await client.fetchTag('javascript', 0)

      const url = (fetch as any).mock.calls[0][0] as string
      expect(url).toContain('/articles?tag=javascript')
      expect(url).toContain('page=1')
      expect(url).toContain('per_page=30')
    })

    it('paginates correctly', async () => {
      const fetch = mockFetch([makeDevtoArticle()])
      const client = new DevtoClient(fetch as any)

      await client.fetchTag('rust', 2)

      const url = (fetch as any).mock.calls[0][0] as string
      expect(url).toContain('tag=rust')
      expect(url).toContain('page=3')
    })

    it('returns FeedItem array', async () => {
      const fetch = mockFetch([makeDevtoArticle({ tag_list: ['typescript'] })])
      const client = new DevtoClient(fetch as any)

      const items = await client.fetchTag('typescript', 0)

      expect(items).toHaveLength(1)
      expect(items[0].source).toBe('devto')
      expect(items[0].tags).toContain('typescript')
    })

    it('throws on non-ok response', async () => {
      const fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
      const client = new DevtoClient(fetch as any)

      await expect(client.fetchTag('bad', 0)).rejects.toThrow('DEV API error: 500')
    })
  })

  describe('fetchArticle', () => {
    it('fetches /articles/{id}', async () => {
      const article = makeDevtoArticle({ id: 42 })
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(article),
      })
      const client = new DevtoClient(fetch as any)

      await client.fetchArticle(42)

      expect(fetch).toHaveBeenCalledWith('https://dev.to/api/articles/42')
    })

    it('returns a FeedItem', async () => {
      const article = makeDevtoArticle({ id: 42, title: 'Single Article' })
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(article),
      })
      const client = new DevtoClient(fetch as any)

      const item = await client.fetchArticle(42)

      expect(item.id).toBe('dev:42')
      expect(item.source).toBe('devto')
      expect(item.title).toBe('Single Article')
    })

    it('throws on non-ok response', async () => {
      const fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
      const client = new DevtoClient(fetch as any)

      await expect(client.fetchArticle(999)).rejects.toThrow('DEV API error: 404')
    })
  })

  describe('fetchComments', () => {
    function makeRawComment(overrides = {}): any {
      return {
        id_code: 'abc',
        body_html: '<p>Test comment</p>',
        created_at: '2024-01-15T10:30:00Z',
        user: { username: 'testuser', name: 'Test User' },
        children: [],
        ...overrides,
      }
    }

    it('fetches /comments?a_id={articleId}', async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
      const client = new DevtoClient(fetch as any)

      await client.fetchComments(42)

      expect(fetch).toHaveBeenCalledWith('https://dev.to/api/comments?a_id=42')
    })

    it('maps top-level comments to CommentItem', async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([makeRawComment({ id_code: 'x1' })]),
      })
      const client = new DevtoClient(fetch as any)

      const comments = await client.fetchComments(1)

      expect(comments).toHaveLength(1)
      expect(comments[0].id).toBe('dev:x1')
      expect(comments[0].source).toBe('devto')
      expect(comments[0].author).toBe('testuser')
      expect(comments[0].text).toBe('<p>Test comment</p>')
      expect(comments[0].depth).toBe(0)
      expect(comments[0].children).toEqual([])
    })

    it('builds nested comment trees from children', async () => {
      const nested = makeRawComment({
        id_code: 'parent',
        children: [
          makeRawComment({
            id_code: 'child',
            children: [makeRawComment({ id_code: 'grandchild' })],
          }),
        ],
      })
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([nested]),
      })
      const client = new DevtoClient(fetch as any)

      const comments = await client.fetchComments(1)

      expect(comments).toHaveLength(1)
      expect(comments[0].id).toBe('dev:parent')
      expect(comments[0].depth).toBe(0)
      expect(comments[0].children).toHaveLength(1)
      expect(comments[0].children[0].id).toBe('dev:child')
      expect(comments[0].children[0].depth).toBe(1)
      expect(comments[0].children[0].children[0].id).toBe('dev:grandchild')
      expect(comments[0].children[0].children[0].depth).toBe(2)
    })

    it('returns empty array when no comments', async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })
      const client = new DevtoClient(fetch as any)

      const comments = await client.fetchComments(1)

      expect(comments).toEqual([])
    })

    it('throws on non-ok response', async () => {
      const fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
      const client = new DevtoClient(fetch as any)

      await expect(client.fetchComments(1)).rejects.toThrow('DEV API error: 500')
    })
  })
})
