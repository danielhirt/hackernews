import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGoto = vi.fn()
vi.mock('$app/navigation', () => ({
  goto: (...args: unknown[]) => mockGoto(...args),
}))

vi.mock('$lib/feed.svelte', () => ({
  refreshFeed: vi.fn(),
  getFeedState: () => ({
    source: 'hackernews',
    feedId: 'top',
    items: [],
    loading: false,
    loadingMore: false,
    tag: null,
  }),
}))

vi.mock('$lib/settings.svelte', () => ({
  getSettings: () => ({ value: { keyboardNav: true } }),
}))

import { handleKeydown, getKeyboardState } from '../src/lib/keyboard.svelte'

function makeKeyEvent(key: string, overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    target: document.body,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as KeyboardEvent
}

describe('keyboard navigation', () => {
  let kb: ReturnType<typeof getKeyboardState>

  beforeEach(() => {
    kb = getKeyboardState()
    kb.selectedIndex = 0
    kb.storyIds = ['hn:1', 'hn:2', 'hn:3']
    mockGoto.mockClear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('j/k movement', () => {
    it('j moves selection down', () => {
      handleKeydown(makeKeyEvent('j'))
      expect(kb.selectedIndex).toBe(1)
    })

    it('k moves selection up', () => {
      kb.selectedIndex = 2
      handleKeydown(makeKeyEvent('k'))
      expect(kb.selectedIndex).toBe(1)
    })

    it('j clamps at last item', () => {
      kb.selectedIndex = 2
      handleKeydown(makeKeyEvent('j'))
      expect(kb.selectedIndex).toBe(2)
    })

    it('k clamps at first item', () => {
      kb.selectedIndex = 0
      handleKeydown(makeKeyEvent('k'))
      expect(kb.selectedIndex).toBe(0)
    })
  })

  describe('o key (open item)', () => {
    it('navigates to internal detail page via data-href', () => {
      const card = document.createElement('div')
      card.setAttribute('data-index', '0')
      card.setAttribute('data-href', '/item/hn:1')
      document.body.appendChild(card)

      handleKeydown(makeKeyEvent('o'))
      expect(mockGoto).toHaveBeenCalledWith('/item/hn:1')
    })

    it('opens external URL in new tab via data-href', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

      const card = document.createElement('div')
      card.setAttribute('data-index', '0')
      card.setAttribute('data-href', 'https://example.com/article')
      document.body.appendChild(card)

      handleKeydown(makeKeyEvent('o'))
      expect(openSpy).toHaveBeenCalledWith('https://example.com/article', '_blank', 'noopener')
      expect(mockGoto).not.toHaveBeenCalled()

      openSpy.mockRestore()
    })

    it('does nothing when no card found', () => {
      handleKeydown(makeKeyEvent('o'))
      expect(mockGoto).not.toHaveBeenCalled()
    })

    it('does nothing when card has no data-href', () => {
      const card = document.createElement('div')
      card.setAttribute('data-index', '0')
      document.body.appendChild(card)

      handleKeydown(makeKeyEvent('o'))
      expect(mockGoto).not.toHaveBeenCalled()
    })
  })

  describe('c key (open comments)', () => {
    it('navigates to item detail page', () => {
      handleKeydown(makeKeyEvent('c'))
      expect(mockGoto).toHaveBeenCalledWith('/item/hn:1')
    })
  })

  describe('ignores input fields', () => {
    it('does not handle keys when target is input', () => {
      const input = document.createElement('input')
      handleKeydown(makeKeyEvent('j', { target: input } as unknown as Partial<KeyboardEvent>))
      expect(kb.selectedIndex).toBe(0)
    })

    it('does not handle keys when target is textarea', () => {
      const textarea = document.createElement('textarea')
      handleKeydown(makeKeyEvent('j', { target: textarea } as unknown as Partial<KeyboardEvent>))
      expect(kb.selectedIndex).toBe(0)
    })
  })
})
