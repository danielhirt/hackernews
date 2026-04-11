import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import StoryCard from '../src/components/StoryCard.svelte'
import type { Story } from '@hackernews/core'

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

function makeStory(overrides: Partial<Story> = {}): Story {
  return {
    id: 1,
    title: 'Test Story',
    score: 42,
    by: 'testuser',
    time: Math.floor(Date.now() / 1000) - 3600,
    descendants: 5,
    type: 'story',
    ...overrides,
  }
}

describe('StoryCard text toggle', () => {
  describe('toggle button', () => {
    it('renders the toggle button on every card', () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')
      expect(toggle).toBeTruthy()
    })

    it('shows ▸ when panel is closed', () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      expect(toggle.textContent).toBe('▸')
    })

    it('shows ▾ when panel is open', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      await fireEvent.click(toggle)
      expect(toggle.textContent).toBe('▾')
    })

    it('has title "Show post text" when story has text', () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Hello</p>' }), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      expect(toggle.getAttribute('title')).toBe('Show post text')
    })

    it('has title "No post content" when story has no text', () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      expect(toggle.getAttribute('title')).toBe('No post content')
    })

    it('has .has-text class when story.text exists', () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      expect(toggle.classList.contains('has-text')).toBe(true)
    })

    it('does not have .has-text class when story.text is absent', () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      const toggle = container.querySelector('.text-toggle')!
      expect(toggle.classList.contains('has-text')).toBe(false)
    })
  })

  describe('text panel', () => {
    it('is hidden by default', () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      expect(container.querySelector('.text-panel')).toBeNull()
    })

    it('opens when toggle is clicked', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.text-panel')).toBeTruthy()
    })

    it('closes when toggle is clicked again', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
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
          story: makeStory({ text: '<p>This is <b>bold</b> content</p>' }),
          index: 0,
        },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const content = container.querySelector('.text-content')!
      expect(content.querySelector('b')?.textContent).toBe('bold')
    })

    it('shows "No post content." when story has no text', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const noContent = container.querySelector('.no-content')!
      expect(noContent.textContent).toBe('No post content.')
    })

    it('does not show panel-actions when story has no text', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.panel-actions')).toBeNull()
    })

    it('shows panel-actions when story has text', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.panel-actions')).toBeTruthy()
    })
  })

  describe('expand/collapse controls', () => {
    it('shows "Show more" button by default', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const buttons = container.querySelectorAll('.expand-toggle')
      expect(buttons[0].textContent?.trim()).toBe('Show more')
    })

    it('shows "Collapse" button alongside "Show more"', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const buttons = container.querySelectorAll('.expand-toggle')
      expect(buttons).toHaveLength(2)
      expect(buttons[1].textContent?.trim()).toBe('Collapse')
    })

    it('toggles text-content to expanded on "Show more" click', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const content = container.querySelector('.text-content')!
      expect(content.classList.contains('expanded')).toBe(false)

      const showMore = container.querySelectorAll('.expand-toggle')[0]
      await fireEvent.click(showMore)
      expect(content.classList.contains('expanded')).toBe(true)
    })

    it('changes "Show more" to "Show less" when expanded', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const showMore = container.querySelectorAll('.expand-toggle')[0]
      await fireEvent.click(showMore)
      expect(showMore.textContent?.trim()).toBe('Show less')
    })

    it('collapses back to preview on "Show less" click', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const toggle = container.querySelectorAll('.expand-toggle')[0]
      await fireEvent.click(toggle) // expand
      await fireEvent.click(toggle) // collapse
      const content = container.querySelector('.text-content')!
      expect(content.classList.contains('expanded')).toBe(false)
      expect(toggle.textContent?.trim()).toBe('Show more')
    })

    it('closes the entire panel on "Collapse" click', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.text-panel')).toBeTruthy()

      const collapse = container.querySelectorAll('.expand-toggle')[1]
      await fireEvent.click(collapse)
      expect(container.querySelector('.text-panel')).toBeNull()
    })

    it('resets expanded state when panel is closed via toggle icon', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggleBtn = container.querySelector('.text-toggle')!

      // Open and expand
      await fireEvent.click(toggleBtn)
      await fireEvent.click(container.querySelectorAll('.expand-toggle')[0])
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
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggleBtn = container.querySelector('.text-toggle')!

      // Open and expand
      await fireEvent.click(toggleBtn)
      await fireEvent.click(container.querySelectorAll('.expand-toggle')[0])

      // Collapse
      await fireEvent.click(container.querySelectorAll('.expand-toggle')[1])

      // Reopen — should be in preview mode
      await fireEvent.click(toggleBtn)
      const content = container.querySelector('.text-content')!
      expect(content.classList.contains('expanded')).toBe(false)
    })
  })

  describe('toggle icon reflects panel state', () => {
    it('reverts to ▸ after Collapse', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggleBtn = container.querySelector('.text-toggle')!
      await fireEvent.click(toggleBtn)
      expect(toggleBtn.textContent).toBe('▾')

      await fireEvent.click(container.querySelectorAll('.expand-toggle')[1])
      expect(toggleBtn.textContent).toBe('▸')
    })

    it('has .active class when panel is open', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      const toggleBtn = container.querySelector('.text-toggle')!
      expect(toggleBtn.classList.contains('active')).toBe(false)
      await fireEvent.click(toggleBtn)
      expect(toggleBtn.classList.contains('active')).toBe(true)
    })

    it('loses .active class when panel is closed', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
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
        props: { story: makeStory(), index: 0 },
      })
      const btn = container.querySelector('.ai-toggle')
      expect(btn).toBeTruthy()
      expect(btn!.textContent).toBe('✦')
    })

    it('has title "AI summary"', () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      expect(container.querySelector('.ai-toggle')!.getAttribute('title')).toBe('AI summary')
    })

    it('opens the panel when clicked', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('Summary text', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      expect(container.querySelector('.text-panel')).toBeNull()
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.text-panel')).toBeTruthy()
    })

    it('does not show "No post content." when AI summary is loading', async () => {
      vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {})) // never resolves
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.no-content')).toBeNull()
    })
  })

  describe('fetch and display', () => {
    it('shows loading cursor while fetching', async () => {
      vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.summary-spinner')).toBeTruthy()
    })

    it('shows "AI Summary" label', async () => {
      vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.summary-label')!.textContent).toBe('AI Summary')
    })

    it('displays summary text after successful fetch', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('# Hello\nThis is a summary.', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
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
        props: { story: makeStory({ id: 42 }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(mockSaveSummary).toHaveBeenCalledWith('hn:42', 'cached text')
      })
    })

    it('shows error on failed fetch', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('Story not found', { status: 404 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
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
        props: { story: makeStory(), index: 0 },
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
        props: { story: makeStory({ id: 99 }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(fetch).toHaveBeenCalledWith('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: 99, model: 'sonnet' }),
      })
    })
  })

  describe('summary controls', () => {
    it('shows Show more, Regenerate, and Dismiss after loading', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const section = container.querySelector('.summary-section')!
      const buttons = section.querySelectorAll('.expand-toggle')
      expect(buttons).toHaveLength(4)
      expect(buttons[0].textContent?.trim()).toBe('Show more')
      expect(buttons[1].textContent?.trim()).toBe('Copy')
      expect(buttons[2].textContent?.trim()).toBe('Regenerate')
      expect(buttons[3].textContent?.trim()).toBe('Dismiss')
    })

    it('toggles summary expanded state on Show more click', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const summaryContent = container.querySelector('.summary-content')!
      expect(summaryContent.classList.contains('expanded')).toBe(false)

      const showMore = container.querySelector('.summary-section')!.querySelectorAll('.expand-toggle')[0]
      await fireEvent.click(showMore)
      expect(summaryContent.classList.contains('expanded')).toBe(true)
      expect(showMore.textContent?.trim()).toBe('Show less')
    })

    it('clears summary on Dismiss click', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory({ id: 7 }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const dismiss = container.querySelector('.summary-section')!.querySelectorAll('.expand-toggle')[3]
      await fireEvent.click(dismiss)
      expect(container.querySelector('.summary-section')).toBeNull()
      expect(mockClearSummary).toHaveBeenCalledWith('hn:7')
    })

    it('triggers a new fetch on Regenerate click', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response('first', { status: 200 }))
        .mockResolvedValueOnce(new Response('second', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const regen = container.querySelector('.summary-section')!.querySelectorAll('.expand-toggle')[2]
      await fireEvent.click(regen)
      await vi.waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(2)
      })
    })

    it('does not show controls while loading', async () => {
      vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
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
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(fetch).not.toHaveBeenCalled()
    })

    it('displays cached summary when panel opens', async () => {
      mockGetSummary.mockReturnValue('cached summary')
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      expect(container.querySelector('.summary-content')).toBeTruthy()
      expect(container.querySelector('.summary-content')!.textContent).toContain('cached summary')
    })

    it('has .active class on AI button when summary is cached', () => {
      mockGetSummary.mockReturnValue('cached')
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      expect(container.querySelector('.ai-toggle')!.classList.contains('active')).toBe(true)
    })
  })

  describe('coexistence with OP text', () => {
    it('shows both OP text and summary in the same panel', async () => {
      mockGetSummary.mockReturnValue('summary here')
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>OP text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.text-content')).toBeTruthy()
      expect(container.querySelector('.summary-section')).toBeTruthy()
    })

    it('shows summary section separated from OP text', async () => {
      mockGetSummary.mockReturnValue('summary here')
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>OP text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const section = container.querySelector('.summary-section')!
      expect(section.querySelector('.summary-label')!.textContent).toBe('AI Summary')
    })

    it('has divider when both OP text and summary exist', async () => {
      mockGetSummary.mockReturnValue('summary')
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.summary-section')!.classList.contains('has-divider')).toBe(true)
    })

    it('has no divider when only summary exists (no OP text)', async () => {
      mockGetSummary.mockReturnValue('summary')
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
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

    it('shows Copy button when summary is loaded', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const buttons = container.querySelector('.summary-section')!.querySelectorAll('.expand-toggle')
      expect(buttons[1].textContent?.trim()).toBe('Copy')
    })

    it('copies summary text to clipboard on click', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('summary to copy', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const copyBtn = container.querySelector('.summary-section')!.querySelectorAll('.expand-toggle')[1]
      await fireEvent.click(copyBtn)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('summary to copy')
    })

    it('shows "Copied!" feedback after clicking', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('text', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      const copyBtn = container.querySelector('.summary-section')!.querySelectorAll('.expand-toggle')[1]
      await fireEvent.click(copyBtn)
      expect(copyBtn.textContent?.trim()).toBe('Copied!')
    })
  })

  describe('OP text link styling', () => {
    it('renders links with underline in OP text', async () => {
      const { container } = render(StoryCard, {
        props: {
          story: makeStory({ text: '<p>Check <a href="https://example.com">this</a></p>' }),
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
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const label = container.querySelector('.section-label')
      expect(label).toBeTruthy()
      expect(label!.textContent).toBe('OP Comment')
    })

    it('does not show "OP Comment" label when story has no text', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      expect(container.querySelector('.section-label')).toBeNull()
    })
  })

  describe('AI button disabled state', () => {
    it('is disabled while summary is loading', async () => {
      vi.mocked(fetch).mockReturnValueOnce(new Promise(() => {}))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      const btn = container.querySelector('.ai-toggle') as HTMLButtonElement
      await fireEvent.click(btn)
      expect(btn.disabled).toBe(true)
    })

    it('is not disabled when idle', () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
      })
      const btn = container.querySelector('.ai-toggle') as HTMLButtonElement
      expect(btn.disabled).toBe(false)
    })

    it('is not disabled after fetch completes', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('done', { status: 200 }))
      const { container } = render(StoryCard, {
        props: { story: makeStory(), index: 0 },
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
        props: { story: makeStory({ text: '<p>OP text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.ai-toggle')!)
      await vi.waitFor(() => {
        expect(container.querySelector('.summary-content')).toBeTruthy()
      })
      // Dismiss the summary
      const dismiss = container.querySelector('.summary-section')!.querySelectorAll('.expand-toggle')[3]
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
        props: { story: makeStory({ text: '<p>OP text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      // Expand summary only
      const summaryShowMore = container.querySelector('.summary-section')!.querySelectorAll('.expand-toggle')[0]
      await fireEvent.click(summaryShowMore)
      // Summary expanded, OP text still in preview
      expect(container.querySelector('.summary-content')!.classList.contains('expanded')).toBe(true)
      expect(container.querySelector('.text-content')!.classList.contains('expanded')).toBe(false)
    })

    it('expands OP text without expanding summary', async () => {
      mockGetSummary.mockReturnValue('cached summary')
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>OP text</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      // Expand OP text only
      const textShowMore = container.querySelectorAll('.panel-actions')[0].querySelectorAll('.expand-toggle')[0]
      await fireEvent.click(textShowMore)
      // OP text expanded, summary still in preview
      expect(container.querySelector('.text-content')!.classList.contains('expanded')).toBe(true)
      expect(container.querySelector('.summary-content')!.classList.contains('expanded')).toBe(false)
    })
  })

  describe('text panel background', () => {
    it('renders text-panel element when open', async () => {
      const { container } = render(StoryCard, {
        props: { story: makeStory({ text: '<p>Content</p>' }), index: 0 },
      })
      await fireEvent.click(container.querySelector('.text-toggle')!)
      const panel = container.querySelector('.text-panel')
      expect(panel).toBeTruthy()
    })
  })
})
