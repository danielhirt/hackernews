import { describe, it, expect, vi } from 'vitest'
import { LobstersClient } from '../src/lobsters.js'

function makeLobstersStory(overrides = {}) {
  return {
    short_id: 'abc123',
    title: 'Test Lobsters Story',
    url: 'https://example.com',
    score: 42,
    created_at: '2024-01-15T10:30:00.000-06:00',
    submitter_user: 'testuser',
    comment_count: 15,
    comments_url: 'https://lobste.rs/s/abc123/test_story',
    short_id_url: 'https://lobste.rs/s/abc123',
    description: '',
    tags: ['programming', 'rust'],
    ...overrides,
  }
}

function mockFetch(stories: object[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(stories),
  })
}

describe('LobstersClient', () => {
  describe('field mapping', () => {
    it('maps a Lobsters story to FeedItem correctly', async () => {
      const story = makeLobstersStory()
      const fetch = mockFetch([story])
      const client = new LobstersClient(fetch as any)

      const items = await client.fetchFeed('hottest', 0)

      expect(items).toHaveLength(1)
      const item = items[0]
      expect(item.id).toBe('lo:abc123')
      expect(item.source).toBe('lobsters')
      expect(item.title).toBe('Test Lobsters Story')
      expect(item.url).toBe('https://example.com')
      expect(item.score).toBe(42)
      expect(item.author).toBe('testuser')
      expect(item.commentCount).toBe(15)
      expect(item.sourceUrl).toBe('https://lobste.rs/s/abc123/test_story')
      expect(item.tags).toEqual(['programming', 'rust'])
      expect(item.originalId).toBe('abc123')
    })

    it('converts created_at ISO string to unix timestamp', async () => {
      const story = makeLobstersStory({ created_at: '2024-01-15T10:30:00.000-06:00' })
      const fetch = mockFetch([story])
      const client = new LobstersClient(fetch as any)

      const items = await client.fetchFeed('hottest', 0)

      // 2024-01-15T10:30:00.000-06:00 = 2024-01-15T16:30:00.000Z
      expect(items[0].timestamp).toBe(Math.floor(new Date('2024-01-15T10:30:00.000-06:00').getTime() / 1000))
    })

    it('sets text from description when present', async () => {
      const story = makeLobstersStory({ description: 'Some description text' })
      const fetch = mockFetch([story])
      const client = new LobstersClient(fetch as any)

      const items = await client.fetchFeed('hottest', 0)

      expect(items[0].text).toBe('Some description text')
    })

    it('sets text to undefined when description is empty', async () => {
      const story = makeLobstersStory({ description: '' })
      const fetch = mockFetch([story])
      const client = new LobstersClient(fetch as any)

      const items = await client.fetchFeed('hottest', 0)

      expect(items[0].text).toBeUndefined()
    })

    it('sets url to undefined when url is empty', async () => {
      const story = makeLobstersStory({ url: '' })
      const fetch = mockFetch([story])
      const client = new LobstersClient(fetch as any)

      const items = await client.fetchFeed('hottest', 0)

      expect(items[0].url).toBeUndefined()
    })
  })

  describe('URL construction', () => {
    it('fetches /{feedId}.json for page 0', async () => {
      const fetch = mockFetch([makeLobstersStory()])
      const client = new LobstersClient(fetch as any)

      await client.fetchFeed('hottest', 0)

      expect(fetch).toHaveBeenCalledWith('https://lobste.rs/hottest.json')
    })

    it('fetches /{feedId}/page/2.json for page 1', async () => {
      const fetch = mockFetch([makeLobstersStory()])
      const client = new LobstersClient(fetch as any)

      await client.fetchFeed('hottest', 1)

      expect(fetch).toHaveBeenCalledWith('https://lobste.rs/hottest/page/2.json')
    })

    it('fetches /{feedId}/page/3.json for page 2', async () => {
      const fetch = mockFetch([makeLobstersStory()])
      const client = new LobstersClient(fetch as any)

      await client.fetchFeed('hottest', 2)

      expect(fetch).toHaveBeenCalledWith('https://lobste.rs/hottest/page/3.json')
    })

    it('uses custom baseUrl when provided', async () => {
      const fetch = mockFetch([makeLobstersStory()])
      const client = new LobstersClient(fetch as any, 'https://custom.example.com')

      await client.fetchFeed('newest', 0)

      expect(fetch).toHaveBeenCalledWith('https://custom.example.com/newest.json')
    })
  })

  describe('error handling', () => {
    it('throws on non-ok response', async () => {
      const fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 })
      const client = new LobstersClient(fetch as any)

      await expect(client.fetchFeed('hottest', 0)).rejects.toThrow('Lobsters API error: 503')
    })
  })

  describe('fetchTag', () => {
    it('fetches /t/{tag}.json for page 0', async () => {
      const fetch = mockFetch([makeLobstersStory()])
      const client = new LobstersClient(fetch as any)

      await client.fetchTag('osdev', 0)

      expect(fetch).toHaveBeenCalledWith('https://lobste.rs/t/osdev.json')
    })

    it('fetches /t/{tag}/page/2.json for page 1', async () => {
      const fetch = mockFetch([makeLobstersStory()])
      const client = new LobstersClient(fetch as any)

      await client.fetchTag('rust', 1)

      expect(fetch).toHaveBeenCalledWith('https://lobste.rs/t/rust/page/2.json')
    })

    it('returns FeedItem array', async () => {
      const fetch = mockFetch([makeLobstersStory({ tags: ['osdev'] })])
      const client = new LobstersClient(fetch as any)

      const items = await client.fetchTag('osdev', 0)

      expect(items).toHaveLength(1)
      expect(items[0].source).toBe('lobsters')
      expect(items[0].tags).toContain('osdev')
    })

    it('uses custom baseUrl', async () => {
      const fetch = mockFetch([makeLobstersStory()])
      const client = new LobstersClient(fetch as any, '/api/lobsters?path=')

      await client.fetchTag('linux', 0)

      expect(fetch).toHaveBeenCalledWith('/api/lobsters?path=/t/linux.json')
    })

    it('throws on non-ok response', async () => {
      const fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
      const client = new LobstersClient(fetch as any)

      await expect(client.fetchTag('nonexistent', 0)).rejects.toThrow('Lobsters API error: 404')
    })
  })

  describe('fetchUser', () => {
    const mockUser = {
      username: 'pushcx',
      created_at: '2012-08-14T20:25:08.000-05:00',
      is_admin: true,
      is_moderator: true,
      about: '<p>Site admin</p>',
      avatar_url: '/avatars/pushcx-100.png',
      invited_by_user: 'jcs',
      github_username: 'pushcx',
      mastodon_username: 'lobsters',
    }

    it('fetches /~{username}.json', async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      })
      const client = new LobstersClient(fetch as any)

      await client.fetchUser('pushcx')

      expect(fetch).toHaveBeenCalledWith('https://lobste.rs/~pushcx.json')
    })

    it('returns user data with all fields', async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      })
      const client = new LobstersClient(fetch as any)

      const user = await client.fetchUser('pushcx')

      expect(user.username).toBe('pushcx')
      expect(user.created_at).toBe('2012-08-14T20:25:08.000-05:00')
      expect(user.is_admin).toBe(true)
      expect(user.about).toBe('<p>Site admin</p>')
      expect(user.avatar_url).toBe('/avatars/pushcx-100.png')
      expect(user.invited_by_user).toBe('jcs')
      expect(user.github_username).toBe('pushcx')
    })

    it('uses custom baseUrl', async () => {
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      })
      const client = new LobstersClient(fetch as any, '/api/lobsters?path=')

      await client.fetchUser('testuser')

      expect(fetch).toHaveBeenCalledWith('/api/lobsters?path=/~testuser.json')
    })

    it('throws on non-ok response', async () => {
      const fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
      const client = new LobstersClient(fetch as any)

      await expect(client.fetchUser('nonexistent')).rejects.toThrow('Lobsters API error: 404')
    })
  })
})
