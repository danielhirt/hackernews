import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Story, Comment, CommentItem } from '@omnifeed/core'
import {
  periodCutoff,
  filterByPeriod,
  sortStories,
  sortComments,
  sortCommentTree,
} from '../src/lib/sort-filter'

function makeStory(overrides: Partial<Story> & { id: number }): Story {
  return {
    title: `Story ${overrides.id}`,
    score: 10,
    by: 'user',
    time: 1000000,
    descendants: 0,
    type: 'story',
    ...overrides,
  }
}

function makeComment(overrides: Partial<Comment> & { id: number }): Comment {
  return {
    text: `Comment ${overrides.id}`,
    by: 'user',
    time: 1000000,
    parent: 1,
    ...overrides,
  }
}

describe('periodCutoff', () => {
  it('returns 0 for "all"', () => {
    expect(periodCutoff('all')).toBe(0)
  })

  it('returns cutoff for "week"', () => {
    const now = 1000000
    const cutoff = periodCutoff('week', now)
    expect(cutoff).toBe(now - 7 * 24 * 60 * 60)
  })

  it('returns cutoff for "month"', () => {
    const now = 5000000
    const cutoff = periodCutoff('month', now)
    expect(cutoff).toBe(now - 30 * 24 * 60 * 60)
  })

  it('returns cutoff for "year"', () => {
    const now = 50000000
    const cutoff = periodCutoff('year', now)
    expect(cutoff).toBe(now - 365 * 24 * 60 * 60)
  })
})

describe('filterByPeriod', () => {
  const now = 1000000
  const stories = [
    makeStory({ id: 1, time: now }),
    makeStory({ id: 2, time: now - 3 * 86400 }),
    makeStory({ id: 3, time: now - 14 * 86400 }),
    makeStory({ id: 4, time: now - 60 * 86400 }),
    makeStory({ id: 5, time: now - 400 * 86400 }),
  ]

  it('returns all items for "all"', () => {
    expect(filterByPeriod(stories, 'all')).toHaveLength(5)
  })

  it('filters to past week', () => {
    const result = filterByPeriod(stories, 'week', now)
    expect(result.map((s) => s.id)).toEqual([1, 2])
  })

  it('filters to past month', () => {
    const result = filterByPeriod(stories, 'month', now)
    expect(result.map((s) => s.id)).toEqual([1, 2, 3])
  })

  it('filters to past year', () => {
    const result = filterByPeriod(stories, 'year', now)
    expect(result.map((s) => s.id)).toEqual([1, 2, 3, 4])
  })

  it('returns empty array when no items match', () => {
    const old = [makeStory({ id: 1, time: 100 })]
    expect(filterByPeriod(old, 'week', now)).toEqual([])
  })

  it('does not mutate the original array', () => {
    const original = [...stories]
    filterByPeriod(stories, 'week', now)
    expect(stories).toEqual(original)
  })
})

describe('sortStories', () => {
  const stories = [
    makeStory({ id: 1, time: 300, score: 50, descendants: 10 }),
    makeStory({ id: 2, time: 100, score: 200, descendants: 5 }),
    makeStory({ id: 3, time: 500, score: 10, descendants: 100 }),
    makeStory({ id: 4, time: 200, score: 80, descendants: 0 }),
  ]

  it('sorts newest first by default', () => {
    const result = sortStories(stories, 'newest')
    expect(result.map((s) => s.id)).toEqual([3, 1, 4, 2])
  })

  it('sorts oldest first', () => {
    const result = sortStories(stories, 'oldest')
    expect(result.map((s) => s.id)).toEqual([2, 4, 1, 3])
  })

  it('sorts by points descending', () => {
    const result = sortStories(stories, 'points')
    expect(result.map((s) => s.id)).toEqual([2, 4, 1, 3])
  })

  it('sorts by most discussed descending', () => {
    const result = sortStories(stories, 'discussed')
    expect(result.map((s) => s.id)).toEqual([3, 1, 2, 4])
  })

  it('does not mutate the original array', () => {
    const original = [...stories]
    sortStories(stories, 'points')
    expect(stories).toEqual(original)
  })

  it('handles empty array', () => {
    expect(sortStories([], 'newest')).toEqual([])
  })

  it('handles stories with missing descendants', () => {
    const items = [
      makeStory({ id: 1, descendants: undefined as unknown as number }),
      makeStory({ id: 2, descendants: 5 }),
    ]
    const result = sortStories(items, 'discussed')
    expect(result[0].id).toBe(2)
  })
})

describe('sortComments', () => {
  const comments = [
    makeComment({ id: 1, time: 300 }),
    makeComment({ id: 2, time: 100 }),
    makeComment({ id: 3, time: 500 }),
  ]

  it('sorts newest first by default', () => {
    const result = sortComments(comments, 'newest')
    expect(result.map((c) => c.id)).toEqual([3, 1, 2])
  })

  it('sorts oldest first', () => {
    const result = sortComments(comments, 'oldest')
    expect(result.map((c) => c.id)).toEqual([2, 1, 3])
  })

  it('treats non-time sort modes as newest', () => {
    const byPoints = sortComments(comments, 'points')
    const byNewest = sortComments(comments, 'newest')
    expect(byPoints.map((c) => c.id)).toEqual(byNewest.map((c) => c.id))
  })

  it('does not mutate the original array', () => {
    const original = [...comments]
    sortComments(comments, 'oldest')
    expect(comments).toEqual(original)
  })

  it('handles empty array', () => {
    expect(sortComments([], 'newest')).toEqual([])
  })
})

describe('sortCommentTree', () => {
  function makeCommentItem(overrides: Partial<CommentItem> & { id: string }): CommentItem {
    return {
      source: 'hackernews',
      text: 'test',
      author: 'user',
      timestamp: 1000,
      children: [],
      depth: 0,
      ...overrides,
    }
  }

  it('returns items unchanged in default mode', () => {
    const items = [
      makeCommentItem({ id: 'a', timestamp: 300 }),
      makeCommentItem({ id: 'b', timestamp: 100 }),
      makeCommentItem({ id: 'c', timestamp: 500 }),
    ]
    const result = sortCommentTree(items, 'default')
    expect(result.map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts newest first', () => {
    const items = [
      makeCommentItem({ id: 'a', timestamp: 300 }),
      makeCommentItem({ id: 'b', timestamp: 100 }),
      makeCommentItem({ id: 'c', timestamp: 500 }),
    ]
    const result = sortCommentTree(items, 'newest')
    expect(result.map((c) => c.id)).toEqual(['c', 'a', 'b'])
  })

  it('sorts oldest first', () => {
    const items = [
      makeCommentItem({ id: 'a', timestamp: 300 }),
      makeCommentItem({ id: 'b', timestamp: 100 }),
      makeCommentItem({ id: 'c', timestamp: 500 }),
    ]
    const result = sortCommentTree(items, 'oldest')
    expect(result.map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts children recursively', () => {
    const items = [
      makeCommentItem({
        id: 'parent',
        timestamp: 100,
        children: [
          makeCommentItem({ id: 'child-old', timestamp: 200, depth: 1 }),
          makeCommentItem({ id: 'child-new', timestamp: 400, depth: 1 }),
          makeCommentItem({ id: 'child-mid', timestamp: 300, depth: 1 }),
        ],
      }),
    ]
    const result = sortCommentTree(items, 'newest')
    expect(result[0].children.map((c) => c.id)).toEqual(['child-new', 'child-mid', 'child-old'])
  })

  it('sorts grandchildren recursively', () => {
    const items = [
      makeCommentItem({
        id: 'root',
        timestamp: 100,
        children: [
          makeCommentItem({
            id: 'child',
            timestamp: 200,
            depth: 1,
            children: [
              makeCommentItem({ id: 'gc-old', timestamp: 300, depth: 2 }),
              makeCommentItem({ id: 'gc-new', timestamp: 500, depth: 2 }),
            ],
          }),
        ],
      }),
    ]
    const result = sortCommentTree(items, 'oldest')
    expect(result[0].children[0].children.map((c) => c.id)).toEqual(['gc-old', 'gc-new'])
  })

  it('does not mutate the original array', () => {
    const items = [
      makeCommentItem({ id: 'a', timestamp: 300 }),
      makeCommentItem({ id: 'b', timestamp: 100 }),
    ]
    const original = items.map((i) => i.id)
    sortCommentTree(items, 'newest')
    expect(items.map((i) => i.id)).toEqual(original)
  })

  it('handles empty array', () => {
    expect(sortCommentTree([], 'newest')).toEqual([])
  })

  describe('focus mode simulation (single-root subtree)', () => {
    it('sorts children of a focused comment by newest', () => {
      const focused = [
        makeCommentItem({
          id: 'root',
          timestamp: 100,
          children: [
            makeCommentItem({ id: 'child-a', timestamp: 200, depth: 1 }),
            makeCommentItem({ id: 'child-b', timestamp: 400, depth: 1 }),
            makeCommentItem({ id: 'child-c', timestamp: 300, depth: 1 }),
          ],
        }),
      ]
      const result = sortCommentTree(focused, 'newest')
      expect(result[0].children.map((c) => c.id)).toEqual(['child-b', 'child-c', 'child-a'])
    })

    it('sorts children of a focused comment by oldest', () => {
      const focused = [
        makeCommentItem({
          id: 'root',
          timestamp: 100,
          children: [
            makeCommentItem({ id: 'child-b', timestamp: 400, depth: 1 }),
            makeCommentItem({ id: 'child-a', timestamp: 200, depth: 1 }),
          ],
        }),
      ]
      const result = sortCommentTree(focused, 'oldest')
      expect(result[0].children.map((c) => c.id)).toEqual(['child-a', 'child-b'])
    })

    it('preserves children order in default mode', () => {
      const focused = [
        makeCommentItem({
          id: 'root',
          timestamp: 100,
          children: [
            makeCommentItem({ id: 'child-b', timestamp: 400, depth: 1 }),
            makeCommentItem({ id: 'child-a', timestamp: 200, depth: 1 }),
          ],
        }),
      ]
      const result = sortCommentTree(focused, 'default')
      expect(result[0].children.map((c) => c.id)).toEqual(['child-b', 'child-a'])
    })

    it('sorts deeply nested children in focused subtree', () => {
      const focused = [
        makeCommentItem({
          id: 'root',
          timestamp: 100,
          children: [
            makeCommentItem({
              id: 'child',
              timestamp: 200,
              depth: 1,
              children: [
                makeCommentItem({ id: 'gc-old', timestamp: 300, depth: 2 }),
                makeCommentItem({ id: 'gc-new', timestamp: 500, depth: 2 }),
                makeCommentItem({ id: 'gc-mid', timestamp: 400, depth: 2 }),
              ],
            }),
          ],
        }),
      ]
      const result = sortCommentTree(focused, 'newest')
      expect(result[0].children[0].children.map((c) => c.id)).toEqual(['gc-new', 'gc-mid', 'gc-old'])
    })

    it('does not mutate the focused subtree', () => {
      const focused = [
        makeCommentItem({
          id: 'root',
          timestamp: 100,
          children: [
            makeCommentItem({ id: 'c1', timestamp: 300, depth: 1 }),
            makeCommentItem({ id: 'c2', timestamp: 100, depth: 1 }),
          ],
        }),
      ]
      const originalOrder = focused[0].children.map((c) => c.id)
      sortCommentTree(focused, 'newest')
      expect(focused[0].children.map((c) => c.id)).toEqual(originalOrder)
    })

    it('handles focused comment with no children', () => {
      const focused = [makeCommentItem({ id: 'leaf', timestamp: 100 })]
      const result = sortCommentTree(focused, 'newest')
      expect(result).toHaveLength(1)
      expect(result[0].children).toEqual([])
    })
  })
})

describe('collection item sorting and filtering', () => {
  interface CollectionItem {
    id: string
    title: string
    author: string
    timestamp: number
    score: number
    commentCount: number
    source: string
  }

  function makeItem(overrides: Partial<CollectionItem> & { id: string }): CollectionItem {
    return {
      title: `Item ${overrides.id}`,
      author: 'user',
      timestamp: 1000,
      score: 10,
      commentCount: 0,
      source: 'hackernews',
      ...overrides,
    }
  }

  function sortItems(items: CollectionItem[], mode: string): CollectionItem[] {
    const sorted = [...items]
    switch (mode) {
      case 'newest': sorted.sort((a, b) => b.timestamp - a.timestamp); break
      case 'oldest': sorted.sort((a, b) => a.timestamp - b.timestamp); break
      case 'points': sorted.sort((a, b) => b.score - a.score); break
      case 'discussed': sorted.sort((a, b) => b.commentCount - a.commentCount); break
    }
    return sorted
  }

  function filterItems(items: CollectionItem[], query: string): CollectionItem[] {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) =>
      i.title.toLowerCase().includes(q) || i.author.toLowerCase().includes(q)
    )
  }

  const items = [
    makeItem({ id: 'hn:1', title: 'Alpha Post', author: 'alice', timestamp: 300, score: 50, commentCount: 10 }),
    makeItem({ id: 'lo:2', title: 'Beta Article', author: 'bob', timestamp: 100, score: 200, commentCount: 5, source: 'lobsters' }),
    makeItem({ id: 'dev:3', title: 'Gamma Guide', author: 'carol', timestamp: 500, score: 10, commentCount: 100, source: 'devto' }),
  ]

  it('sorts by newest first', () => {
    expect(sortItems(items, 'newest').map((i) => i.id)).toEqual(['dev:3', 'hn:1', 'lo:2'])
  })

  it('sorts by oldest first', () => {
    expect(sortItems(items, 'oldest').map((i) => i.id)).toEqual(['lo:2', 'hn:1', 'dev:3'])
  })

  it('sorts by points descending', () => {
    expect(sortItems(items, 'points').map((i) => i.id)).toEqual(['lo:2', 'hn:1', 'dev:3'])
  })

  it('sorts by most discussed descending', () => {
    expect(sortItems(items, 'discussed').map((i) => i.id)).toEqual(['dev:3', 'hn:1', 'lo:2'])
  })

  it('returns original order for unknown sort mode', () => {
    expect(sortItems(items, 'saved').map((i) => i.id)).toEqual(['hn:1', 'lo:2', 'dev:3'])
  })

  it('does not mutate original array', () => {
    const original = items.map((i) => i.id)
    sortItems(items, 'newest')
    expect(items.map((i) => i.id)).toEqual(original)
  })

  it('filters by title substring', () => {
    expect(filterItems(items, 'alpha').map((i) => i.id)).toEqual(['hn:1'])
  })

  it('filters by author substring', () => {
    expect(filterItems(items, 'bob').map((i) => i.id)).toEqual(['lo:2'])
  })

  it('filters case-insensitively', () => {
    expect(filterItems(items, 'GAMMA').map((i) => i.id)).toEqual(['dev:3'])
  })

  it('returns all items for empty query', () => {
    expect(filterItems(items, '').map((i) => i.id)).toEqual(['hn:1', 'lo:2', 'dev:3'])
  })

  it('returns all items for whitespace-only query', () => {
    expect(filterItems(items, '   ').map((i) => i.id)).toEqual(['hn:1', 'lo:2', 'dev:3'])
  })

  it('returns empty when no items match', () => {
    expect(filterItems(items, 'nonexistent')).toEqual([])
  })

  it('filters by partial title match', () => {
    expect(filterItems(items, 'art').map((i) => i.id)).toEqual(['lo:2'])
  })

  it('combines sort and filter', () => {
    const filtered = filterItems(items, 'a')
    const sorted = sortItems(filtered, 'newest')
    expect(sorted.map((i) => i.id)).toEqual(['dev:3', 'hn:1', 'lo:2'])
  })
})
