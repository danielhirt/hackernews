import type { Comment, CommentItem } from './models.js'
import type { HnClient } from './client.js'

export function hnCommentToItem(comment: Comment, depth: number): CommentItem {
  return {
    id: `hn:${comment.id}`,
    source: 'hackernews',
    text: comment.text,
    author: comment.by,
    timestamp: comment.time,
    deleted: comment.deleted,
    dead: comment.dead,
    children: [],
    depth,
  }
}

export async function fetchHnCommentTree(
  client: HnClient,
  ids: number[],
  depth = 0,
  maxDepth = 10,
): Promise<CommentItem[]> {
  if (!ids.length || depth > maxDepth) return []

  const results = await Promise.all(ids.map((id) => client.fetchItem(id)))
  const items: CommentItem[] = []

  for (const result of results) {
    if (!result || !('parent' in result)) continue
    const comment = result as Comment
    if (comment.deleted || comment.dead) continue

    const item = hnCommentToItem(comment, depth)
    if (comment.kids?.length) {
      item.children = await fetchHnCommentTree(client, comment.kids, depth + 1, maxDepth)
    }
    items.push(item)
  }

  return items
}

/**
 * Fetches a batch of HN comments WITHOUT recursing into their children.
 * Each returned item has `pendingKidIds` set to the comment's native `kids`
 * array, signalling to the UI that children exist but haven't been loaded.
 *
 * Use this for the initial render of a thread to avoid the unbounded fan-out
 * problem. Lazy-fetch children with `fetchHnCommentChildren` when the user
 * expands a node.
 */
export async function fetchHnCommentBatch(
  client: HnClient,
  ids: number[],
  depth = 0,
): Promise<CommentItem[]> {
  if (!ids.length) return []

  const results = await Promise.all(ids.map((id) => client.fetchItem(id)))
  const items: CommentItem[] = []

  for (const result of results) {
    if (!result || !('parent' in result)) continue
    const comment = result as Comment
    if (comment.deleted || comment.dead) continue

    const item = hnCommentToItem(comment, depth)
    if (comment.kids?.length) {
      item.pendingKidIds = comment.kids
    }
    items.push(item)
  }

  return items
}

/**
 * Lazy-fetches the direct children of a comment that was loaded with
 * `fetchHnCommentBatch`. Returns the children as another batch (their own
 * children are deferred via `pendingKidIds`). Caller is responsible for
 * splicing the result into the parent's `children` and clearing
 * `pendingKidIds`.
 */
export function fetchHnCommentChildren(
  client: HnClient,
  parentDepth: number,
  kidIds: number[],
): Promise<CommentItem[]> {
  return fetchHnCommentBatch(client, kidIds, parentDepth + 1)
}
