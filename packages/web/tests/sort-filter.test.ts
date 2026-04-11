import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Story, Comment, CommentItem } from '@hackernews/core'
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
})
