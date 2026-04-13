import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import NavBar from '../src/components/NavBar.svelte'

let mockUrlSearch = ''
let mockUrlPathname = '/'
let mockFeedSource = 'hackernews'
let mockFeedId = 'top'
let mockFeedTag: string | null = null

vi.mock('$app/state', () => ({
  page: {
    get url() {
      return {
        search: mockUrlSearch,
        pathname: mockUrlPathname,
        searchParams: new URLSearchParams(mockUrlSearch),
      }
    },
  },
}))

vi.mock('$lib/feed.svelte', () => ({
  refreshFeed: vi.fn(),
  getFeedState: () => ({
    get source() { return mockFeedSource },
    get feedId() { return mockFeedId },
    get tag() { return mockFeedTag },
    get items() { return [] },
    get loading() { return false },
    get loadingMore() { return false },
  }),
}))

vi.mock('$lib/theme.svelte', () => ({
  getTheme: () => ({ value: 'dark' }),
  toggleTheme: vi.fn(),
}))

vi.mock('$app/environment', () => ({
  browser: false,
}))

function setFeedState(source: string, feedId: string, tag: string | null = null) {
  mockFeedSource = source
  mockFeedId = feedId
  mockFeedTag = tag
}

function setUrl(search: string, pathname = '/') {
  mockUrlSearch = search
  mockUrlPathname = pathname
}

describe('NavBar', () => {
  describe('feed tab highlighting', () => {
    it('highlights the active feed tab on a normal feed', () => {
      setUrl('?source=hackernews&feed=top')
      setFeedState('hackernews', 'top')
      const { container } = render(NavBar)
      const tabs = container.querySelectorAll('.tab')
      const activeTab = container.querySelector('.tab.active')
      expect(tabs.length).toBeGreaterThan(0)
      expect(activeTab).toBeTruthy()
      expect(activeTab!.textContent).toBe('Top')
    })

    it('highlights the correct Lobsters feed tab', () => {
      setUrl('?source=lobsters&feed=newest')
      setFeedState('lobsters', 'newest')
      const { container } = render(NavBar)
      const activeTab = container.querySelector('.tab.active')
      expect(activeTab).toBeTruthy()
      expect(activeTab!.textContent).toBe('Newest')
    })

    it('suppresses active tab when a tag filter is active', () => {
      setUrl('?source=lobsters&tag=rust')
      setFeedState('lobsters', 'hottest', 'rust')
      const { container } = render(NavBar)
      const activeTabs = container.querySelectorAll('.tab.active')
      expect(activeTabs).toHaveLength(0)
    })

    it('shows all feed tabs even when tag is active (for navigation away)', () => {
      setUrl('?source=lobsters&tag=rust')
      setFeedState('lobsters', 'hottest', 'rust')
      const { container } = render(NavBar)
      const tabs = container.querySelectorAll('.tab')
      // Lobsters has 3 feeds: Hottest, Newest, Active
      expect(tabs).toHaveLength(3)
    })

    it('re-activates tab when tag is cleared (null)', () => {
      setUrl('?source=lobsters&feed=hottest')
      setFeedState('lobsters', 'hottest', null)
      const { container } = render(NavBar)
      const activeTab = container.querySelector('.tab.active')
      expect(activeTab).toBeTruthy()
      expect(activeTab!.textContent).toBe('Hottest')
    })

    it('highlights correct source in dropdown for tag view', () => {
      setUrl('?source=lobsters&tag=rust')
      setFeedState('lobsters', 'hottest', 'rust')
      const { container } = render(NavBar)
      const sourceBtn = container.querySelector('.source-btn')
      expect(sourceBtn!.textContent).toContain('Lobsters')
    })
  })

  describe('feed tab links', () => {
    it('generates correct feed tab hrefs for current source', () => {
      setUrl('?source=lobsters&feed=hottest')
      setFeedState('lobsters', 'hottest')
      const { container } = render(NavBar)
      const tabs = container.querySelectorAll('.tab')
      const hrefs = Array.from(tabs).map(t => t.getAttribute('href'))
      expect(hrefs).toContain('/?source=lobsters&feed=hottest')
      expect(hrefs).toContain('/?source=lobsters&feed=newest')
      expect(hrefs).toContain('/?source=lobsters&feed=active')
    })
  })
})
