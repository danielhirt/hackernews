import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import StoryCard from '../src/components/StoryCard.svelte'
import type { FeedItem } from '@hackernews/core'

const mockGetSummary = vi.fn(() => undefined as string | undefined)
const mockSaveSummary = vi.fn()
const mockClearSummary = vi.fn()
const mockSetExpanded = vi.fn()

vi.mock('$lib/read-history.svelte', () => ({
  isRead: () => false,
  markRead: vi.fn(),
}))

vi.mock('$lib/collections.svelte', () => ({
  getCollections: () => ({ value: [] }),
  addToCollection: vi.fn(),
  removeFromCollection: vi.fn(),
}))

vi.mock('$lib/summaries.svelte', () => ({
  getSummary: (...args: unknown[]) => mockGetSummary(...args),
  saveSummary: (...args: unknown[]) => mockSaveSummary(...args),
  clearSummary: (...args: unknown[]) => mockClearSummary(...args),
  setExpanded: (...args: unknown[]) => mockSetExpanded(...args),
  isExpanded: () => false,
}))

vi.mock('$lib/settings.svelte', () => ({
  getSettings: () => ({ value: { model: 'sonnet' } }),
}))

vi.mock('$app/environment', () => ({
  browser: false,
}))

function makeItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'hn:1',
    source: 'hackernews',
    title: 'Test Story',
    score: 42,
    author: 'testuser',
    timestamp: Math.floor(Date.now() / 1000) - 3600,
    commentCount: 5,
    sourceUrl: 'https://news.ycombinator.com/item?id=1',
    originalId: 1,
    ...overrides,
  }
}

describe('StoryCard text toggle', () => {
  describe('toggle button', () => {
    it('renders the toggle button on every card', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')
      expect(toggle).toBeTruthy()
    })

    it('shows ▸ when panel is closed', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      expect(toggle.textContent).toBe('▸')
    })

    it('shows ▾ when panel is open', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      await fireEvent.click(toggle)
      expect(toggle.textContent).toBe('▾')
    })

    it('has title "Show post text" when story has text', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Hello</p>' }), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      expect(toggle.getAttribute('title')).toBe('Show post text')
    })

    it('has title "No post content" when story has no text', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      expect(toggle.getAttribute('title')).toBe('No post content')
    })

    it('has .has-text class when story.text exists', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      expect(toggle.classList.contains('has-text')).toBe(true)
    })

    it('does not have .has-text class when story.text is absent', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      expect(toggle.classList.contains('has-text')).toBe(false)
    })
  })

  describe('text panel', () => {
    it('is hidden by default', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      expect(container.querySelector('.text-panel')).toBeNull()
    })

    it('opens when toggle is clicked', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.text-panel')).toBeTruthy()
    })

    it('closes when toggle is clicked again', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      await fireEvent.click(toggle)
      expect(container.querySelector('.text-panel')).toBeTruthy()
      await fireEvent.click(toggle)
      expect(container.querySelector('.text-panel')).toBeNull()
    })

    it('renders story.text as HTML when present', async () => {
      const { container } = render(StoryCard, {
        props: {
          item: makeItem({ text: '<p>This is <b>bold</b> content</p>' }),
          index: 0,
        },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const content = container.querySelector('.text-content')!
      expect(content.querySelector('b')?.textContent).toBe('bold')
    })

    it('shows "No post content." when story has no text', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const noContent = container.querySelector('.no-content')!
      expect(noContent.textContent).toBe('No post content.')
    })

    it('does not show panel-actions when story has no text', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.panel-actions')).toBeNull()
    })

    it('shows panel-actions when story has text', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.panel-actions')).toBeTruthy()
    })
  })

  describe('expand/collapse controls', () => {
    it('shows "Show more" text button by default', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const textBtn = container.querySelector('.action-text')!
      expect(textBtn.textContent?.trim()).toBe('Show more')
    })

    it('shows text action plus two icon actions (copy, close)', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const textBtn = container.querySelector('.action-text')!
      expect(textBtn.textContent?.trim()).toBe('Show more')
      const icons = container.querySelectorAll('.action-icon')
      expect(icons).toHaveLength(2)
      expect(icons[0].textContent?.trim()).toBe('⧉')
      expect(icons[1].textContent?.trim()).toBe('✕')
    })

    it('toggles text-content to expanded on "Show more" click', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const content = container.querySelector('.text-content')!
      expect(content.classList.contains('expanded')).toBe(false)

      const showMore = container.querySelector('.action-text')!
      await fireEvent.click(showMore)
      expect(content.classList.contains('expanded')).toBe(true)
    })

    it('changes to "Show less" when expanded', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const expandBtn = container.querySelector('.action-text')!
      await fireEvent.click(expandBtn)
      expect(expandBtn.textContent?.trim()).toBe('Show less')
    })

    it('collapses back to preview on "Show less" click', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const toggle = container.querySelector('.action-text')!
      await fireEvent.click(toggle) // expand
      await fireEvent.click(toggle) // collapse
      const content = container.querySelector('.text-content')!
      expect(content.classList.contains('expanded')).toBe(false)
      expect(toggle.textContent?.trim()).toBe('Show more')
    })

    it('closes the entire panel on "Collapse" click', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.text-panel')).toBeTruthy()

      const collapse = container.querySelectorAll('.action-icon')[1]
      await fireEvent.click(collapse)
      expect(container.querySelector('.text-panel')).toBeNull()
    })

    it('resets expanded state when panel is closed via toggle icon', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggleBtn = container.querySelector('.text-toggle')!

      // Open and expand
      await fireEvent.click(toggleBtn)
      await fireEvent.click(container.querySelector('.action-text')!)
      expect(container.querySelector('.text-content.expanded')).toBeTruthy()

      // Close via toggle
      await fireEvent.click(toggleBtn)
      expect(container.querySelector('.text-panel')).toBeNull()

      // Reopen — should be in preview mode, not expanded
      await fireEvent.click(toggleBtn)
      const content = container.querySelector('.text-content')!
      expect(content.classList.contains('expanded')).toBe(false)
    })

    it('resets expanded state when panel is closed via Collapse button', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggleBtn = container.querySelector('.text-toggle')!

      // Open and expand
      await fireEvent.click(toggleBtn)
      await fireEvent.click(container.querySelector('.action-text')!)

      // Collapse
      await fireEvent.click(container.querySelectorAll('.action-icon')[1])

      // Reopen — should be in preview mode
      await fireEvent.click(toggleBtn)
      const content = container.querySelector('.text-content')!
      expect(content.classList.contains('expanded')).toBe(false)
    })
  })

  describe('toggle icon reflects panel state', () => {
    it('reverts to ▸ after Collapse', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggleBtn = container.querySelector('.text-toggle')!
      await fireEvent.click(toggleBtn)
      expect(toggleBtn.textContent).toBe('▾')

      await fireEvent.click(container.querySelectorAll('.action-icon')[1])
      expect(toggleBtn.textContent).toBe('▸')
    })

    it('has .active class when panel is open', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggleBtn = container.querySelector('.text-toggle')!
      expect(toggleBtn.classList.contains('active')).toBe(false)
      await fireEvent.click(toggleBtn)
      expect(toggleBtn.classList.contains('active')).toBe(true)
    })

    it('loses .active class when panel is closed', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggleBtn = container.querySelector('.text-toggle')!
      await fireEvent.click(toggleBtn)
      await fireEvent.click(toggleBtn)
      expect(toggleBtn.classList.contains('active')).toBe(false)
    })
  })
})

describe('StoryCard AI summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSummary.mockReturnValue(undefined)
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('AI button', () => {
    it('renders the ✦ button on every card', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      const btn = container.querySelector('.ai-toggle')
      expect(btn).toBeTruthy()
      expect(btn!.textContent).toBe('✦')
    })

    it('has title "AI summary"', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      expect(container.querySelector('.ai-toggle')!.getAttribute('title')).toBe('AI summary')
    })

    it('opens the panel when clicked', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('Summary text', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      expect(container.querySelector('.text-panel')).toBeNull()
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.text-panel')).toBeTruthy()
    })

    it('does not show "No post content." when AI summary is loading', async () => {
      vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {})) // never resolves
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.no-content')).toBeNull()
    })
  })

  describe('fetch and display', () => {
    it('shows loading cursor while fetching', async () => {
      vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.summary-spinner')).toBeTruthy()
    })

    it('shows "AI Summary" label', async () => {
      vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.summary-label')!.textContent).toBe('AI Summary')
    })

    it('displays summary text after successful fetch', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('# Hello\nThis is a summary.', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      // Wait for the async fetch to resolve
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      expect(container.querySelector('.summary-content')!.textContent).toContain('This is a summary.')
    })

    it('saves summary to cache on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('cached text', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem({ id: 'hn:42', originalId: 42 }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(mockSaveSummary).toHaveBeenCalledWith('hn:42', 'cached text')
      })
    })

    it('shows error on failed fetch', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('Story not found', { status: 404 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-error')).toBeTruthy()
      })
      expect(container.querySelector('.summary-error')!.textContent).toBe('Story not found')
    })

    it('shows error on network failure', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-error')).toBeTruthy()
      })
      expect(container.querySelector('.summary-error')!.textContent).toBe('Failed to generate summary.')
    })

    it('sends correct payload to /api/summarize', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('ok', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem({ id: 'hn:99', originalId: 99 }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(fetch).toHaveBeenCalledWith('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'sonnet', storyId: 99 }),
      })
    })
  })

  describe('summary controls', () => {
    it('shows action icons (expand, copy, regenerate, dismiss) after loading', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const section = container.querySelector('.summary-section')!
      const textBtn = section.querySelector('.action-text')!
      expect(textBtn.textContent?.trim()).toBe('Show more')
      const icons = section.querySelectorAll('.action-icon')
      expect(icons).toHaveLength(3)
      expect(icons[0].textContent?.trim()).toBe('⧉')
      expect(icons[1].textContent?.trim()).toBe('↻')
      expect(icons[2].textContent?.trim()).toBe('✕')
    })

    it('toggles summary expanded state on Show more click', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const summaryContent = container.querySelector('.summary-content')!
      expect(summaryContent.classList.contains('expanded')).toBe(false)

      const showMore = container.querySelector('.summary-section .action-text')!
      await fireEvent.click(showMore)
      expect(summaryContent.classList.contains('expanded')).toBe(true)
      expect(showMore.textContent?.trim()).toBe('Show less')
    })

    it('clears summary on Dismiss click', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem({ id: 'hn:7', originalId: 7 }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const dismiss = container.querySelector('.summary-section')!.querySelectorAll('.action-icon')[2]
      await fireEvent.click(dismiss)
      expect(container.querySelector('.summary-section')).toBeNull()
      expect(mockClearSummary).toHaveBeenCalledWith('hn:7')
    })

    it('triggers a new fetch on Regenerate click', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response('first', { status: 200 }))
        .mockResolvedValueOnce(new Response('second', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const regen = container.querySelector('.summary-section')!.querySelectorAll('.action-icon')[1]
      await fireEvent.click(regen)
      await vi.waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2)
      })
    })

    it('does not show controls while loading', async () => {
      vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      const section = container.querySelector('.summary-section')!
      expect(section.querySelector('.panel-actions')).toBeNull()
    })
  })

  describe('cached summary', () => {
    it('does not re-fetch if cached summary exists', async () => {
      mockGetSummary.mockReturnValue('cached summary')
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('displays cached summary when panel opens', async () => {
      mockGetSummary.mockReturnValue('cached summary')
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.summary-content')).toBeTruthy()
      expect(container.querySelector('.summary-content')!.textContent).toContain('cached summary')
    })

    it('has .active class on AI button when summary is cached', () => {
      mockGetSummary.mockReturnValue('cached')
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      expect(container.querySelector('.ai-toggle')!.classList.contains('active')).toBe(true)
    })
  })

  describe('coexistence with OP text', () => {
    it('shows both OP text and summary in the same panel', async () => {
      mockGetSummary.mockReturnValue('summary here')
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>OP text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.text-content')).toBeTruthy()
      expect(container.querySelector('.summary-section')).toBeTruthy()
    })

    it('shows summary section separated from OP text', async () => {
      mockGetSummary.mockReturnValue('summary here')
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>OP text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const section = container.querySelector('.summary-section')!
      expect(section.querySelector('.summary-label')!.textContent).toBe('AI Summary')
    })

    it('has divider when both OP text and summary exist', async () => {
      mockGetSummary.mockReturnValue('summary')
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.summary-section')!.classList.contains('has-divider')).toBe(true)
    })

    it('has no divider when only summary exists (no OP text)', async () => {
      mockGetSummary.mockReturnValue('summary')
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.summary-section')!.classList.contains('has-divider')).toBe(false)
    })
  })

  describe('summary copy button', () => {
    beforeEach(() => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      })
    })

    it('shows copy icon when summary is loaded', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const buttons = container.querySelector('.summary-section')!.querySelectorAll('.action-icon')
      expect(buttons[0].textContent?.trim()).toBe('⧉')
    })

    it('copies summary text to clipboard on click', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary to copy', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const copyBtn = container.querySelector('.summary-section')!.querySelectorAll('.action-icon')[0]
      await fireEvent.click(copyBtn)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('summary to copy')
    })

    it('shows ✓ feedback after clicking copy', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('text', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const copyBtn = container.querySelector('.summary-section')!.querySelectorAll('.action-icon')[0]
      await fireEvent.click(copyBtn)
      expect(copyBtn.textContent?.trim()).toBe('✓')
    })
  })

  describe('OP text link styling', () => {
    it('renders links with underline in OP text', async () => {
      const { container } = render(StoryCard, {
        props: {
          item: makeItem({ text: '<p>Check <a href="https://example.com">this</a></p>' }),
          index: 0,
        },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const link = container.querySelector('.text-content a')
      expect(link).toBeTruthy()
    })
  })

  describe('OP Comment label', () => {
    it('shows "OP Comment" label when story has text', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const label = container.querySelector('.section-label')
      expect(label).toBeTruthy()
      expect(label!.textContent).toBe('OP Comment')
    })

    it('does not show "OP Comment" label when story has no text', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.section-label')).toBeNull()
    })
  })

  describe('AI button disabled state', () => {
    it('is disabled while summary is loading', async () => {
      vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      const btn = container.querySelector('.ai-toggle') as HTMLButtonElement
      await fireEvent.click(btn)
      expect(btn.disabled).toBe(true)
    })

    it('is not disabled when idle', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      const btn = container.querySelector('.ai-toggle') as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })

    it('is not disabled after fetch completes', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('done', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      const btn = container.querySelector('.ai-toggle') as HTMLButtonElement
      await fireEvent.click(btn)
      await vi.waitFor(() => {
        expect(btn.disabled).toBe(false)
      })
    })
  })

  describe('panel stays open after dismiss when OP text exists', () => {
    it('keeps panel open with OP text visible after summary dismiss', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>OP text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      // Dismiss the summary
      const dismiss = container.querySelector('.summary-section')!.querySelectorAll('.action-icon')[2]
      await fireEvent.click(dismiss)
      // Panel should still be open with OP text
      expect(container.querySelector('.text-panel')).toBeTruthy()
      expect(container.querySelector('.text-content')).toBeTruthy()
      expect(container.querySelector('.summary-section')).toBeNull()
    })
  })

  describe('independent expand states', () => {
    it('expands summary without expanding OP text', async () => {
      mockGetSummary.mockReturnValue('cached summary')
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>OP text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      // Expand summary only
      const summaryShowMore = container.querySelector('.summary-section .action-text')!
      await fireEvent.click(summaryShowMore)
      // Summary expanded, OP text still in preview
      expect(container.querySelector('.summary-content')!.classList.contains('expanded')).toBe(true)
      expect(container.querySelector('.text-content')!.classList.contains('expanded')).toBe(false)
    })

    it('expands OP text without expanding summary', async () => {
      mockGetSummary.mockReturnValue('cached summary')
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>OP text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      // Expand OP text only
      const textShowMore = container.querySelectorAll('.panel-actions')[0].querySelector('.action-text')!
      await fireEvent.click(textShowMore)
      // OP text expanded, summary still in preview
      expect(container.querySelector('.text-content')!.classList.contains('expanded')).toBe(true)
      expect(container.querySelector('.summary-content')!.classList.contains('expanded')).toBe(false)
    })
  })

  describe('text panel background', () => {
    it('renders text-panel element when open', async () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const panel = container.querySelector('.text-panel')
      expect(panel).toBeTruthy()
    })
  })
})

describe('StoryCard multi-source behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSummary.mockReturnValue(undefined)
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('source badge', () => {
    it('hides source badge by default', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ id: 'lo:abc', source: 'lobsters' }), index: 0 },
      })
      expect(container.querySelector('.source-badge')).toBeNull()
    })

    it('shows source badge when showSourceBadge is true', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ id: 'lo:abc', source: 'lobsters' }), index: 0, showSourceBadge: true },
      })
      const badge = container.querySelector('.source-badge')
      expect(badge).toBeTruthy()
      expect(badge!.textContent).toBe('Lobsters')
    })

    it('shows HN badge when showSourceBadge is true', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0, showSourceBadge: true },
      })
      const badge = container.querySelector('.source-badge')
      expect(badge).toBeTruthy()
      expect(badge!.textContent).toBe('HN')
    })

    it('shows DEV badge with correct text', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ id: 'dev:123', source: 'devto' }), index: 0, showSourceBadge: true },
      })
      const badge = container.querySelector('.source-badge')
      expect(badge).toBeTruthy()
      expect(badge!.textContent).toBe('DEV')
    })
  })

  describe('expand toggle visibility', () => {
    it('shows expand toggle for Lobsters items without text', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ id: 'lo:abc', source: 'lobsters' }), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')
      expect(toggle).toBeTruthy()
      expect((toggle as HTMLElement).style.visibility).not.toBe('hidden')
    })

    it('shows expand toggle for DEV items without text', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ id: 'dev:123', source: 'devto' }), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')
      expect(toggle).toBeTruthy()
      expect((toggle as HTMLElement).style.visibility).not.toBe('hidden')
    })
  })

  describe('AI summary for Lobsters', () => {
    it('renders ✦ button for Lobsters items', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ id: 'lo:abc', source: 'lobsters' }), index: 0 },
      })
      expect(container.querySelector('.ai-toggle')).toBeTruthy()
    })

    it('renders ✦ button for DEV items', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ id: 'dev:123', source: 'devto' }), index: 0 },
      })
      expect(container.querySelector('.ai-toggle')).toBeTruthy()
    })

    it('sends generic payload for Lobsters items', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('ok', { status: 200 }))
      const { container } = render(StoryCard, {
        props: {
          item: makeItem({
            id: 'lo:abc',
            source: 'lobsters',
            title: 'Lobsters Post',
            url: 'https://example.com',
            text: 'Post body',
          }),
          index: 0,
        },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(fetch).toHaveBeenCalledWith('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'sonnet',
          title: 'Lobsters Post',
          url: 'https://example.com',
          text: 'Post body',
        }),
      })
    })
  })

  describe('tag pills', () => {
    it('renders tags as pills in the title row', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ tags: ['rust', 'linux', 'osdev'] }), index: 0 },
      })
      const pills = container.querySelectorAll('.tag-pill')
      expect(pills).toHaveLength(3)
      expect(pills[0].textContent).toBe('rust')
      expect(pills[1].textContent).toBe('linux')
      expect(pills[2].textContent).toBe('osdev')
    })

    it('caps tags at 3', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ tags: ['a', 'b', 'c', 'd', 'e'] }), index: 0 },
      })
      expect(container.querySelectorAll('.tag-pill')).toHaveLength(3)
    })

    it('renders no pills when tags are absent', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem(), index: 0 },
      })
      expect(container.querySelectorAll('.tag-pill')).toHaveLength(0)
    })

    it('renders Lobsters tag pills as internal links', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ source: 'lobsters', tags: ['osdev'] }), index: 0 },
      })
      const pill = container.querySelector('.tag-pill') as HTMLAnchorElement
      expect(pill.tagName).toBe('A')
      expect(pill.getAttribute('href')).toBe('/?source=lobsters&tag=osdev')
    })

    it('renders DEV tag pills as internal links', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ source: 'devto', tags: ['javascript'] }), index: 0 },
      })
      const pill = container.querySelector('.tag-pill') as HTMLAnchorElement
      expect(pill.tagName).toBe('A')
      expect(pill.getAttribute('href')).toBe('/?source=devto&tag=javascript')
    })

    it('places tag pills inside the title row', () => {
      const { container } = render(StoryCard, {
        props: { item: makeItem({ tags: ['rust'] }), index: 0 },
      })
      const titleRow = container.querySelector('.title-row')!
      expect(titleRow.querySelector('.tag-pill')).toBeTruthy()
    })
  })
})
